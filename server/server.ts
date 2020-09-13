// only import path and use path.join
// to avoid name collision with join function
import * as path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const staticDir = path.join(__dirname, '../public/')
import Sentry from '@sentry/node';

import cookieParser from 'cookie-parser';
import express from 'express';

import socketIo from 'socket.io'
import * as httpServer from 'http'

import * as Game from './game.js';
import * as socketHandler from './socketHandler.js';
import * as socketInterface from './socketInterface.js';
import { logger } from './logging.js';

export function createServer(useSentry = true, port = process.env.PORT || 3000) {
  var games: Map<string, Game.Game> = new Map();
  var app = express();
  if (useSentry) {
    addSentry(app);
  }
  app.use(cookieParser());
  app.use('/static', express.static(staticDir));
  // todo: instead of hacking in games with arrow functions
  // have the middlewares fetch games from db or w/e
  app.get('/', (req, res) => root(req, res, games));
  app.get('/game/:code', (req, res) => gamePage(req, res, games));

  var http = new httpServer.Server(app);

  //io needs to be accessablrwhen we setup game - pass it in
  // https://github.com/socketio/socket.io/issues/2276
  var io = socketIo(http, {
    cookie: false,
    // todo: this is a hack to prevent our connection being terminated
    // during large file uploads because we're blocking and can't reply to pongs
    // real answer is to not block
    // loads more info at https://github.com/socketio/socket.io/issues/3025
    pingTimeout: 50000,
    pingInterval: 250000
  });

  // todo make this a post
  // because its not idempotent
  app.get('/make', (req, res) => make(req, res, games, io));
  app.get('/join', (req, res) => join(req, res, games));

  http.listen(port);

  setInterval(() => { socketHandler.checkGameTiming(games , io) }, 1000);
}

function addSentry(app: express.Application) {
  Sentry.init({ dsn: process.env.NODE_SENTRY });
  if (process.env.SENTRY_TESTS == "true") {
    Sentry.captureException(new Error("sentry test server.js"));
  }
  // The request handler must be the first middleware on the app
  app.use(Sentry.Handlers.requestHandler());
  // The error handler must be before any other error middleware and after all controllers
  app.use(Sentry.Handlers.errorHandler());

}

function root(req: express.Request, res: express.Response, games: Map<string, Game.Game>) {

  if (req.query.code == undefined) {
    res.sendFile(staticDir + 'lobby.html');
    return;
  }

  let code = req.query.code.toString();

  if (games.has(code)) {
    var game = games.get(code)!;
    if (game.state != Game.states.NOT_STARTED) {
      logger.log("verbose", "/ Attempt to join game " + code + " that has already started");
      res.redirect(`/static/game_in_progress.html`);
      return;
    } else {
      res.sendFile(staticDir + 'lobby.html');
      return;
    }
  } else {
    logger.log("verbose", `/ Accessing invalid game: ${code}`);
    res.redirect(`/static/game_doesnt_exist.html`);
    return;
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

function make(req: express.Request, res: express.Response, games: Map<string, Game.Game>, io: socketIo.Server) {
  if (!req.query.username) {
    res.redirect('/');
    return;
  }
  let game = socketInterface.setup(
    games,
    io
  )
  var [privateId, publicId] = addUserToGame(game, res, req.query.username.toString());
  if (req.query.format == 'json') {
    res.json({ publicId: publicId, privateId: privateId, gameId: game.code });
  } else {
    res.redirect(`/game/${game.code}`);
  }
};

function join(req: express.Request, res: express.Response, games: Map<string, Game.Game>) {
  logger.log("verbose", "join game redirect");
  //todo: convey errors to user
  if (req.query.code == undefined) {
    logger.log("debug", 'no code supplied');
    res.redirect('/static/game_doesnt_exist.html');
    return;
  }
  var code = req.query.code.toString();
  let game = games.get(code)
  if (game == undefined) {
    logger.log("verbose", `Accessing invalid game: ${req.query.code}`);
    res.redirect(`/static/game_doesnt_exist.html`);
    return;
  }
  if (game.state != Game.states.NOT_STARTED) {
    logger.log("verbose", "Attempt to join game " + code + " that has already started");
    res.redirect(`/static/game_in_progress.html`);
    return;
  }
  logger.log("debug", 'adding to game');
  if (req.query.username == undefined) {
    logger.log("verbose", "Attempt to join game " + code + " without a username");
    // todo: redirect them back to game join screen
    return;
  }
  var [privateId, publicId] = addUserToGame(game, res, req.query.username.toString());

  if (req.query.format == 'json') {
    res.json({ publicId: publicId, privateId: privateId, gameId: code });
  } else {
    res.redirect(`/game/${code}`);
  }
};

function gamePage(req: express.Request, res: express.Response, games: Map<string, Game.Game>) {
  //todo: convey errors to user (template error page?)
  logger.log("debug", `Accessing game: ${req.params.code}`);
  var game = games.get(req.params.code);
  if (game == undefined) {
    logger.log("verbose", `Accessing invalid game: ${req.params.code}`);
    res.redirect(`/static/game_doesnt_exist.html`);
    return;
  }

  if (req.query.format == "json") {
    if (req.query.publicId && req.query.index) {
      res.write(Game.getImage(game, parseInt(req.query.publicId.toString()), parseInt(req.query.index.toString())));
    } else {
      res.json(Game.gameStateForClient(game));
    }
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
