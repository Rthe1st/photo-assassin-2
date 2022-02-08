import * as Sentry from "@sentry/node"

import cookieParser from "cookie-parser"
import express, { NextFunction, Request, Response } from "express"

import { Server } from "socket.io"
import * as https from "https"
import * as http from "http"

import * as path from "path"
import * as fs from "fs"

import * as Game from "./game"

Game.setup()

import * as socketHandler from "./socketHandler"
import * as socketInterface from "./socketInterface"
import { logger } from "./logging"
import { env } from "process"

function devErrorHandler(
  err: any,
  req: Request,
  res: Response,
  _: NextFunction
) {
  console.log("express error")
  console.log(`path: ${req.path}`)
  console.log(`query string: ${Object.entries(req.query)}`)
  console.error(err.stack)
  res.status(500).send("Internal server error - dev handler").end()
}

export function createServer(
  port = process.env.PORT || 3000,
  staticDir = "dist/public/",
  useSentry = true
): http.Server {
  const app = express()
  app.use(express.urlencoded({ extended: true }))

  const httpsOptions: https.ServerOptions = {
    key: fs.readFileSync("./secret/privkey.pem"),
    cert: fs.readFileSync("./secret/cert.pem"),
  }

  // we don't have a chain for self signed certs
  if (env.NODE_ENV === "production") {
    httpsOptions.ca = fs.readFileSync("./secret/chain.pem")
  }

  const httpServer = <http.Server>https.createServer(httpsOptions, app)

  //io needs to be accessible when we setup game - pass it in
  // https://github.com/socketio/socket.io/issues/2276
  const ioServer = new Server(httpServer, {
    cookie: false,
    // todo: this is a hack to prevent our connection being terminated
    // during large file uploads because we're blocking and can't reply to pongs
    // real answer is to not block
    // loads more info at https://github.com/socketio/socket.io/issues/3025
    pingTimeout: 50000,
    pingInterval: 250000,
    // bumping to socket io v3 or v4 makes this the default anyway
    // https://github.com/socketio/socket.io/issues/3477#issuecomment-610265035
    perMessageDeflate: false,
  })

  if (useSentry) {
    Sentry.init({ dsn: process.env.NODE_SENTRY })
    if (process.env.SENTRY_TESTS == "true") {
      Sentry.captureException(new Error("sentry test server.js"))
    }
    // The request handler must be the first middleware on the app
    app.use(Sentry.Handlers.requestHandler())
  }
  app.use(cookieParser())
  app.use("/static", express.static(staticDir))

  staticDir = path.resolve(staticDir) + "/"

  // todo: instead of hacking in games with arrow functions
  // have the middlewares fetch games from db or w/e
  app.get("/", (req, res) => root(staticDir, req, res))
  // for game's we've deleted but client has game data in URL fragment
  // don't server this on game code specific URL
  // so we can cache the page more
  // todo: does the caching logic above even make sense?
  app.get("/archived", (_, res) => res.sendFile(staticDir + "archived.html"))

  app.get("/game/:code", (req, res) => gamePage(staticDir, req, res))
  app.get("/game/:code/download", (req, res) =>
    gameDownloadPage(staticDir, req, res)
  )
  // todo: should these be .use()
  // so we can redirect if someone navigate there by mistake
  app.post("/make", (req, res) => make(staticDir, req, res, ioServer))
  app.post("/join", (req, res) => join(staticDir, req, res))
  if (useSentry) {
    // The error handler must be before any other error middleware and after all controllers
    app.use(Sentry.Handlers.errorHandler())
  }
  if (process.env.NODE_ENV != "production") {
    app.use("/deliberate-error", () => {
      throw new Error("test error")
    })
    app.use(devErrorHandler)
  }

  httpServer.listen(port)

  // todo: work out an optimime value for this
  // too frequent and I'm worried it's events will deplay processing
  // of messages from the client
  // but needs to be low enough for:
  // * telling client the countdown time is over
  // * telling client the game is over
  setInterval(() => {
    socketHandler.checkGameTiming(Game.games, ioServer)
  }, 1000)

  return httpServer
}

function root(staticDir: string, req: express.Request, res: express.Response) {
  if (req.query.code == undefined) {
    res.sendFile(staticDir + "lobby.html")
    return
  }

  const game = Game.getGame(req.query.code.toString())
  if (game == undefined) {
    logger.log("verbose", `/ Accessing invalid game: ${req.query.code}`)
    res.status(404)
    res.sendFile(`${staticDir}/game_doesnt_exist.html`)
  } else if (game.state != Game.states.NOT_STARTED) {
    // todo: what if user is already in the game?
    // maybe root should leave this case for /join to handle
    // (same with code doesnt exist as well?)
    logger.log(
      "verbose",
      "/ Attempt to join game " + req.query.code + " that has already started"
    )
    res.status(403)
    res.sendFile(`${staticDir}/game_in_progress.html`)
  } else {
    res.sendFile(staticDir + "lobby.html")
  }
}

function addUserToGame(
  game: Game.Game,
  res: express.Response,
  username: string
) {
  const { privateId: privateId, publicId: publicId } = Game.addPlayer(
    game,
    username
  )

  socketHandler.addUser(publicId, game)

  // todo: set good settings (https only, etc)
  res.cookie("gameId", game.code, { sameSite: "strict" })
  res.cookie("privateId", privateId, { sameSite: "strict" })
  res.cookie("publicId", publicId, { sameSite: "strict" })
  logger.log("verbose", "Adding user to game", {
    publicId: publicId,
    gameCode: game.code,
  })

  return [privateId, publicId]
}

function make(
  staticDir: string,
  req: express.Request,
  res: express.Response,
  io: Server
) {
  if (!req.body.username) {
    res.status(400)
    res.sendFile(`${staticDir}/no_username.html`)
    return
  }
  const game = socketInterface.setup(io)
  const [privateId, publicId] = addUserToGame(
    game,
    res,
    req.body.username.toString()
  )
  if (req.body.format == "json") {
    res
      .status(200)
      .json({ publicId: publicId, privateId: privateId, gameId: game.code })
      .end()
  } else {
    res.redirect(`/game/${game.code}`)
  }
}

function join(staticDir: string, req: express.Request, res: express.Response) {
  if (req.body.code == undefined) {
    logger.log("debug", "no code supplied")
    res.status(403)
    res.sendFile(`${staticDir}/no_code.html`)
    return
  }
  const game = Game.getGame(req.body.code)
  if (game == undefined) {
    logger.log("verbose", `Accessing invalid game: ${req.body.code}`)
    res.status(404)
    res.sendFile(`${staticDir}/game_doesnt_exist.html`)
    return
  }
  if (game.state != Game.states.NOT_STARTED) {
    logger.log(
      "verbose",
      "Attempt to join game " + game.code + " that has already started"
    )
    res.status(403)
    res.sendFile(`${staticDir}/game_in_progress.html`)
    return
  }
  logger.log("debug", "adding to game")
  if (req.body.username == undefined) {
    logger.log(
      "verbose",
      "Attempt to join game " + game.code + " without a username"
    )
    res.status(403)
    res.sendFile(`${staticDir}/no_username.html`)
    return
  }
  const [privateId, publicId] = addUserToGame(
    game,
    res,
    req.body.username.toString()
  )

  if (req.body.format == "json") {
    res.json({ publicId: publicId, privateId: privateId, gameId: game.code })
  } else {
    res.redirect(`/game/${game.code}`)
  }
}

function gamePage(
  staticDir: string,
  req: express.Request,
  res: express.Response
) {
  logger.log("debug", `Accessing game: ${req.params.code}`)
  const game = Game.getGame(req.params.code)
  if (game == undefined) {
    // then we assume its a finished game
    // that we no longer keep in memory and have push to google cloud
    // client side code will handle detecting an error
    // if there is not matching game in the cloud
    // todo: make sure cloudflare doesn't cache the game page until the game is over
    // but then caches it aggressively
    // one answer: combine archived and index pages into one
    // and cache it always
    res.sendFile(staticDir + "archived.html")
    return
  } else if (!game.idMapping.has(req.cookies["privateId"])) {
    res.redirect(`/?code=${req.params.code}`)
    return
  }
  res.sendFile(staticDir + "index.html")
}

function gameDownloadPage(
  staticDir: string,
  _: express.Request,
  res: express.Response
) {
  //todo: replace $$gamedataplaceholder$$ in archived_for_save.html with the game data json
  // then grab all the images and put them in a zip file with the html
  res.sendFile(staticDir + "archived_for_save.html")
  return
}
