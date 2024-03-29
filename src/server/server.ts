import * as Sentry from "@sentry/node"

import cookieParser from "cookie-parser"
import express, { NextFunction, Request, Response } from "express"

import { Server } from "socket.io"
import * as https from "https"
import * as http from "http"

import * as path from "path"
import * as fs from "fs"

import * as Game from "./game"

import * as socketHandler from "./socketHandler"
import { logger } from "./logging"
import { env } from "process"
import { String } from "runtypes"
import { engine } from "express-handlebars"
import { returnError } from "./validationErrors"
import { Listener, socketListener } from "./socketInterface"

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

export function httpRedirect(): void {
  const app = express()
  app.use(function (req, res) {
    let host
    if (process.env.NODE_ENV === "production") {
      // we don't want to act as an open redirect in prod
      host = "photo-assassin.prangten.com"
    } else {
      host = req.headers.host
    }
    res.redirect(`https://${host}${req.url}`)
  })
  http.createServer(app).listen(80)
}

export function createServer(
  port = 443,
  staticDir = "dist/public/",
  useSentry = true
): void {
  const app = express()

  app.engine("handlebars", engine())
  app.set("view engine", "handlebars")
  app.set("views", "dist/views")

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
  app.use("/games", express.static("games"))

  staticDir = path.resolve(staticDir) + "/"

  // todo: instead of hacking in games with arrow functions
  // have the middlewares fetch games from db or w/e
  app.get("/", (req, res) => root(staticDir, req, res, Game.getGame))

  app.get("/game/:code", (req, res) =>
    gamePage(staticDir, req, res, Game.getGame)
  )
  app.post("/make", (req, res) =>
    make(req, res, (code: string, game: Game.Game) =>
      socketListener(ioServer, code, game)
    )
  )
  app.post("/api/make", (req, res) =>
    apiMake(req, res, (code: string, game: Game.Game) =>
      socketListener(ioServer, code, game)
    )
  )
  app.post("/join", (req, res) => join(req, res))
  app.post("/api/join", (req, res) => apiJoin(req, res))
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

  // todo: work out an optimal value for this
  // too frequent and I'm worried it's events will display processing
  // of messages from the client
  // but needs to be low enough for:
  // * telling client the countdown time is over
  // * telling client the game is over
  setInterval(() => {
    socketHandler.checkGameTiming(Game.games)
  }, 1000)
}

export function root(
  staticDir: string,
  req: express.Request,
  res: express.Response,
  getGame: (code: string) => Game.Game | undefined
) {
  const codeValidation = String.withConstraint(
    (code: string) => !!code.match(gameCodeFormat)
  ).optional()

  const validationResult = codeValidation.validate(req.query?.code)

  if (!validationResult.success) {
    res.status(400)
    returnError(
      res,
      `game code '${req.query?.code}' is wrong, should be 4 words, for example: 'cat-dog-fish-spoon'`
    )
    return
  }

  const code = validationResult.value

  if (code == undefined) {
    res.sendFile(staticDir + "lobby.html")
    return
  }

  const game = getGame(code)
  if (game == undefined) {
    logger.log("verbose", `/ Accessing invalid game: ${code}`)
    res.status(404)
    returnError(res, `No game exists with the code '${code}'`)
    return
  } else if (game.state != Game.states.NOT_STARTED) {
    // todo: what if user is already in the game?
    // maybe root should leave this case for /join to handle
    // (same with code doesn't exist as well?)
    logger.log(
      "verbose",
      "/ Attempt to join game " + code + " that has already started"
    )
    res.status(403)
    returnError(
      res,
      `You can't join the game '${code}' because it has already started.`
    )
    return
  } else {
    res.sendFile(staticDir + "lobby.html")
  }
}

function commonMake(
  req: express.Request,
  res: express.Response,
  listener: (code: string, game: Game.Game) => Listener
): {
  error?: string
  success?: { gameId: string; privateId: string; publicId: number }
} {
  const usernameValidation = String

  const validationResult = usernameValidation.validate(req.body.username)

  if (!validationResult.success) {
    return { error: validationResult.message }
  }

  const username = validationResult.value

  const game = Game.generateGame(listener)
  const addPlayerResult = Game.addPlayer(game, username)
  if (addPlayerResult._tag == "Left") {
    return {
      error: addPlayerResult.left.message,
    }
  }
  const { privateId, publicId } = addPlayerResult.right
  // todo: set good settings (https only, etc)
  res.cookie("gameId", game.code, { sameSite: "strict" })
  res.cookie("privateId", privateId, { sameSite: "strict" })
  res.cookie("publicId", publicId, { sameSite: "strict" })
  return {
    success: { publicId, privateId, gameId: game.code },
  }
}

export function apiMake(
  req: express.Request,
  res: express.Response,
  listener: (code: string, game: Game.Game) => Listener
) {
  const result = commonMake(req, res, listener)
  if (result.error) {
    res.status(400)
    res.json(result.error)
    res.end()
  } else {
    res.status(200)
    res.json(result.success)
    res.end()
  }
}

export function make(
  req: express.Request,
  res: express.Response,
  listener: (code: string, game: Game.Game) => Listener
) {
  const result = commonMake(req, res, listener)

  if (result.error) {
    res.status(400)
    returnError(res, result.error)
    return
  } else {
    res.redirect(`/game/${result.success?.gameId}`)
  }
}

export function commonJoin(
  unvalidatedUsername: unknown,
  unvalidatedCode: unknown
) {
  const maxLength = 50

  const usernameValidation = String.withConstraint(
    (username: string) => username.length > 0 && username.length <= maxLength
  )

  const codeValidation = String.withConstraint((code: string) => {
    if (!code.match(gameCodeFormat)) {
      return `'${code}' is wrong, should be 4 words, for example: 'cat-dog-fish-spoon'`
    } else {
      return true
    }
  })
    .withConstraint((code: string) => {
      const game = Game.getGame(code)
      if (game === undefined) {
        return `'${code}' does not exist`
      }
      return true
    })
    .withConstraint((code: string) => {
      const game = Game.getGame(code)!
      if (game.state != Game.states.NOT_STARTED) {
        return `'${code}' has already started`
      }
      return true
    })

  const usernameValidationResult =
    usernameValidation.validate(unvalidatedUsername)

  if (!usernameValidationResult.success) {
    return {
      error: `username: You cannot use '${
        unvalidatedUsername ?? ""
      }' as a username, it is mandatory and must be less then ${maxLength} characters long.`,
    }
  }

  const username = usernameValidationResult.value

  const codeValidationResult = codeValidation.validate(unvalidatedCode)

  if (!codeValidationResult.success) {
    return {
      error: `code: ${codeValidationResult.message}`,
    }
  }

  const game = Game.getGame(codeValidationResult.value)!

  const addPlayerResult = Game.addPlayer(game, username)

  if (addPlayerResult._tag == "Left") {
    return {
      error: addPlayerResult.left.message,
    }
  }

  const { privateId, publicId } = addPlayerResult.right
  return {
    success: { publicId, privateId, gameId: game.code },
  }
}

export function join(req: express.Request, res: express.Response) {
  const result = commonJoin(req.body.username, req.body.code)

  if (result.error) {
    //todo: maybe we shoudl captrue more specifc error codes
    // 404 - game didnt exist
    // 403, game already started (or 400)
    // 400 bad username
    // ?400 bad game id format?
    res.status(400)
    returnError(res, result.error)
    return
  } else {
    // todo: set good settings (https only, etc)
    res.cookie("gameId", result.success!.gameId, { sameSite: "strict" })
    res.cookie("privateId", result.success!.privateId, { sameSite: "strict" })
    res.cookie("publicId", result.success!.publicId, { sameSite: "strict" })
    res.redirect(`/game/${result.success?.gameId}`)
  }
}

export function apiJoin(req: express.Request, res: express.Response) {
  const result = commonJoin(req.body.username, req.body.code)

  if (result.error) {
    res.status(400)
    res.json(result.error)
  } else {
    res.status(200)
    // todo: set good settings (https only, etc)
    res.cookie("gameId", result.success!.gameId, { sameSite: "strict" })
    res.cookie("privateId", result.success!.privateId, { sameSite: "strict" })
    res.cookie("publicId", result.success!.publicId, { sameSite: "strict" })
    res.json(result.success)
  }
  res.end()
}

export const gameCodeFormat = /^[a-z]+-[a-z]+-[a-z]+-[a-z]+$/

export function gamePage(
  staticDir: string,
  req: express.Request,
  res: express.Response,
  getGame: (code: string) => Game.Game | undefined
) {
  const codeValidation = String.withConstraint(
    (code: string) => !!code.match(gameCodeFormat)
  )

  const validationResult = codeValidation.validate(req.params.code)

  if (!validationResult.success) {
    res.status(400)
    returnError(
      res,
      `game code '${req.params.code}' is wrong, should be 4 words, for example: 'cat-dog-fish-spoon'`
    )
    return
  }

  const code = validationResult.value

  logger.log("debug", `Accessing game: ${code}`)
  const game = getGame(code)

  if (game == undefined) {
    // todo: now we don't use google cloud
    // we can now just check the hardisk our self
    // ---------------------------------------------
    // then we assume its a finished game
    // that we no longer keep in memory and save to disk
    // client side code will handle detecting an error
    // if there is not matching game on disk
    // todo: make sure cloudflare doesn't cache the game page until the game is over
    // but then caches it aggressively
    // one answer: combine archived and index pages into one
    // and cache it always
    res.sendFile(staticDir + "archived.html")
  } else if (!game.idMapping.has(req.cookies["privateId"])) {
    res.redirect(`/?code=${req.params.code}`)
  } else {
    res.sendFile(staticDir + "index.html")
  }
}
