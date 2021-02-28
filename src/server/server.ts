import * as Sentry from '@sentry/node';

import cookieParser from 'cookie-parser';
import express, { NextFunction, Request, Response } from 'express';

import socketIo from 'socket.io'
import * as https from 'https'
import * as http from 'http'

import * as path from 'path';
import * as fs from 'fs';

import * as Game from './game';
import * as socketHandler from './socketHandler';
import * as socketInterface from './socketInterface';
import { logger } from './logging';

function devErrorHandler(err: any, req: Request, res: Response, _: NextFunction) {
  console.log("express error")
  console.log(`path: ${req.path}`)
  console.log(`query string: ${Object.entries(req.query)}`)
  console.error(err.stack)
  res.status(500).send('Internal server error - dev handler')
}

export function createServer(port = process.env.PORT || 3000, staticDir = "dist/public/", useSentry = true): http.Server {
  var app = express();
  app.use(express.urlencoded({ extended: true }));

  let httpServer;
  if (process.env.NODE_ENV != "production") {
    // counterintuitively, we only want https in dev mode
    // because to use GPS in browser, the client needs an https connection
    // In prod, this is provided by Cloudflare using flexible TLS
    // and we can't do TLS from Cloudflare to origin because Heroku only support
    // TLS for paid dynamos
    let httpsOptions = {
      key: fs.readFileSync('./secret/self_signed.key'),
      cert: fs.readFileSync('./secret/self_signed.pem')
    }
    httpServer = <http.Server>(https.createServer(httpsOptions, app));
  } else {
    httpServer = http.createServer(app);
  }

  //io needs to be accessablrwhen we setup game - pass it in
  // https://github.com/socketio/socket.io/issues/2276
  var io = socketIo(httpServer, {
    cookie: false,
    // todo: this is a hack to prevent our connection being terminated
    // during large file uploads because we're blocking and can't reply to pongs
    // real answer is to not block
    // loads more info at https://github.com/socketio/socket.io/issues/3025
    pingTimeout: 50000,
    pingInterval: 250000
  });

  if (useSentry) {
    Sentry.init({ dsn: process.env.NODE_SENTRY });
    if (process.env.SENTRY_TESTS == "true") {
      Sentry.captureException(new Error("sentry test server.js"));
    }
    // The request handler must be the first middleware on the app
    app.use(Sentry.Handlers.requestHandler());
  }
  app.use(cookieParser());
  app.use('/static', express.static(staticDir));

  staticDir = path.resolve(staticDir) + "/"
  var games: Map<string, Game.Game> = new Map();

  // todo: instead of hacking in games with arrow functions
  // have the middlewares fetch games from db or w/e
  app.get('/', (req, res) => root(staticDir, req, res, games));
  // for game's we've deleted but client has game data in URL fragment
  // don't server this on game code specific URL
  // so we can cache the page more
  app.get('/archived', (_, res) => res.sendFile(staticDir + 'archived.html'));
  app.get('/game/:code', (req, res) => gamePage(staticDir, req, res, games));
  app.get('/game/:code/download', (req, res) => gameDownloadPage(staticDir, req, res));
  app.get('/game/:code/images/:id', (req, res) => getImage(req, res, games));
  app.get('/game/:code/low-res-images/:id', (req, res) => getImage(req, res, games));
  // todo: should these be .use()
  // so we can redirect if someone navigate there by mistake
  app.post('/make', (req, res) => make(staticDir, req, res, games, io));
  app.post('/join', (req, res) => join(staticDir, req, res, games));
  if (useSentry) {
    // The error handler must be before any other error middleware and after all controllers
    app.use(Sentry.Handlers.errorHandler());
  }
  if (process.env.NODE_ENV != "production") {
    app.use('/deliberate-error', () => { throw new Error("test error") })
    app.use(devErrorHandler)
  }

  httpServer.listen(port);

  setInterval(() => { socketHandler.checkGameTiming(games, io) }, 10000);

  return httpServer;
}

function root(staticDir: string, req: express.Request, res: express.Response, games: Map<string, Game.Game>) {
  if (req.query.code == undefined) {
    res.sendFile(staticDir + 'lobby.html');
    return;
  }

  let code = req.query.code.toString();

  if (!games.has(code)) {
    logger.log("verbose", `/ Accessing invalid game: ${code}`);
    res.status(404);
    res.sendFile(`${staticDir}/game_doesnt_exist.html`);
  } else if (games.get(code)!.state != Game.states.NOT_STARTED) {
    // todo: what if user is already in the game?
    // maybe root should leave this case for /join to handle
    // (same with code doesnt exist as well?)
    logger.log("verbose", "/ Attempt to join game " + code + " that has already started");
    res.status(403);
    res.sendFile(`${staticDir}/game_in_progress.html`);
  } else {
    res.sendFile(staticDir + 'lobby.html');
  }
};

function addUserToGame(game: Game.Game, res: express.Response, username: string) {

  const { privateId: privateId, publicId: publicId } = Game.addPlayer(game, username);

  socketHandler.addUser(publicId, game);

  // todo: set good settings (https only, etc)
  res.cookie("gameId", game.code, { sameSite: "strict" });
  res.cookie("privateId", privateId, { sameSite: "strict" });
  res.cookie("publicId", publicId, { sameSite: "strict" });
  logger.log("verbose", "Adding user to game", { publicId: publicId, gameCode: game.code });

  return [privateId, publicId];
}

function make(staticDir: string, req: express.Request, res: express.Response, games: Map<string, Game.Game>, io: socketIo.Server) {
  if (!req.body.username) {
    res.status(400);
    res.sendFile(`${staticDir}/no_username.html`);
    return;
  }
  let game = socketInterface.setup(
    games,
    io
  )
  var [privateId, publicId] = addUserToGame(game, res, req.body.username.toString());
  if (req.body.format == 'json') {
    res.json({ publicId: publicId, privateId: privateId, gameId: game.code });
  } else {
    res.redirect(`/game/${game.code}`);
  }
};

function join(staticDir: string, req: express.Request, res: express.Response, games: Map<string, Game.Game>) {
  if (req.body.code == undefined) {
    logger.log("debug", 'no code supplied');
    res.status(403);
    res.sendFile(`${staticDir}/no_code.html`);
    return;
  }
  var code = req.body.code.toString();
  let game = games.get(code)
  if (game == undefined) {
    logger.log("verbose", `Accessing invalid game: ${req.body.code}`);
    res.status(404);
    res.sendFile(`${staticDir}/game_doesnt_exist.html`);
    return;
  }
  if (game.state != Game.states.NOT_STARTED) {
    logger.log("verbose", "Attempt to join game " + code + " that has already started");
    res.status(403);
    res.sendFile(`${staticDir}/game_in_progress.html`);
    return;
  }
  logger.log("debug", 'adding to game');
  if (req.body.username == undefined) {
    logger.log("verbose", "Attempt to join game " + code + " without a username");
    res.status(403);
    res.sendFile(`${staticDir}/no_username.html`);
    return;
  }
  var [privateId, publicId] = addUserToGame(game, res, req.body.username.toString());

  if (req.body.format == 'json') {
    res.json({ publicId: publicId, privateId: privateId, gameId: code });
  } else {
    res.redirect(`/game/${code}`);
  }
};

function getImage(req: express.Request, res: express.Response, games: Map<string, Game.Game>) {
  var game = games.get(req.params.code);
  if (game == undefined) {
    logger.log("verbose", `Accessing invalid game: ${req.params.code}`);
    res.redirect(`/static/game_doesnt_exist.html`);
    return;
  }

  if (req.params.id == undefined || game.actualImages.length <= parseInt(req.params.id)) {
    logger.log("verbose", `Accessing invalid image: ${req.params.code}, ${req.params.id}`);
    res.sendStatus(404)
    return;
  }

  let image;
  if (req.path.indexOf('low-res-images') != -1) {
    // if(req.query.lowRes != undefined){
    image = Game.getActualImage(game, parseInt(req.params.id), true)
    if (image == undefined) {
      // this happens when sharp hasn't finished resizing the image
      res.sendStatus(404)
    }
  } else {
    image = Game.getActualImage(game, parseInt(req.params.id), false)
  }

  res.write(image);
}

function gamePage(staticDir: string, req: express.Request, res: express.Response, games: Map<string, Game.Game>) {
  //todo: convey errors to user (template error page?)
  logger.log("debug", `Accessing game: ${req.params.code}`);
  var game = games.get(req.params.code);
  if (game == undefined) {
    logger.log("verbose", `Accessing invalid game: ${req.params.code}`);
    res.redirect(`/static/game_doesnt_exist.html`);
    return;
  }

  if (req.query.format == "json") {
    res.json(Game.gameStateForClient(game));
    return;
  } else if (game.state == Game.states.FINISHED) {
    res.sendFile(staticDir + 'archived.html');
    return;
  } else if (!(game.idMapping.has(req.cookies["privateId"]))) {

    res.redirect(`/?code=${req.params.code}`);
    return;
  }
  res.sendFile(staticDir + 'index.html');
};

function gameDownloadPage(staticDir: string, _: express.Request, res: express.Response) {
  //todo: replace $$gamedataplaceholder$$ in archived_for_save.html with the game data json
  // then grab all the images and put them in a zip file with the html
  res.sendFile(staticDir + 'archived_for_save.html');
  return;
}