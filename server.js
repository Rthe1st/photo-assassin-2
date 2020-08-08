import { createRequire } from 'module'
const require = createRequire(import.meta.url);

import { dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

import * as fs from 'fs';
import * as Sentry from '@sentry/node';

Sentry.default.init({ dsn: fs.readFileSync('./secrets/sentry', 'utf8')});

var cookieParser = require('cookie-parser');
const express = require('express');
var app = express();
// The request handler must be the first middleware on the app
app.use(Sentry.default.Handlers.requestHandler());

app.use(cookieParser());
var http = require('http').Server(app);
// https://github.com/socketio/socket.io/issues/2276
// (would probably be solved if we bumped socket io version)
var io = require('socket.io')(http, { cookie: false });

var winston = require('winston');
var Writable = require('stream').Writable;

import * as crypto from 'crypto';

import * as Game from './server/game.js';

var logs_for_tests = [];

export function nextLog(){
  return logs_for_tests.shift();
}

var logger;

export function setUpLogging(filePrefix){
  var ws = Writable({objectMode: true});
  ws._write = function (chunk, enc, next) {
      logs_for_tests.push(chunk);
      next();
  };
  
  logger = winston.createLogger({
    level: 'info',
    format: winston.format.json(),
    defaultMeta: { service: 'game logs' },
    transports: [
      new winston.transports.File({ filename: `./logs/${filePrefix}_error.log`, level: 'error', options: { flags: 'w' } }),
      new winston.transports.File({ filename: `./logs/${filePrefix}_verbose.log`, level: 'verbose', options: { flags: 'w' } }),
      new winston.transports.File({ filename: `./logs/${filePrefix}_debug.log`, level: 'debug', options: { flags: 'w' } }),
      //todo: this is only for tests, put behind flag
      new winston.transports.Stream({stream: ws, level: 'verbose'})
    ]
  });
   
}

export var port = process.env.PORT || 3000;

app.use('/static', express.static(__dirname + '/public'));

//todo: handle making and joining games here

app.get('/', function(req, res){
  res.sendFile(__dirname + '/public/lobby.html');
});

var games = new Map();

function addUserToGame(code, res, username){
    var game = games.get(code);

    const [privateId, publicId] = Game.addPlayer(game, username);

    game.nameSpace.emit('New user', {publicId: publicId, gameState: Game.gameStateForClient(game)});

    // todo: set good settings (https only, etc)
    res.cookie("gameId", code, {sameSite: "strict"});
    res.cookie("privateId", privateId, {sameSite: "strict"});
    res.cookie("publicId", publicId, {sameSite: "strict"});
    logger.log("verbose", "Adding user to game", {publicId: publicId, gameCode: code});

    return [privateId, publicId];
}

function generateGame(){
  var first_part = crypto.randomBytes(2).toString('hex');
  var second_part = crypto.randomBytes(2).toString('hex');
  // used number of games as a guarantee prevent collisions
  // (even though collisions must be unlikely anyway for the code to provide security)
  var third_part = games.size.toString(16);
  const code = `${first_part}-${second_part}-${third_part}`;
  var nameSpace = io.of('/' + code);
  nameSpace.on('connection', ioConnect);
  games.set(code, Game.newGame(nameSpace));
  logger.log("verbose", "making game", {gameCode: code});
  return code;
}

function finishGame(game, winner){
  var nextCode = generateGame();
  Game.finishGame(game, nextCode, winner);
  game.nameSpace.emit('game finished', {nextCode: nextCode, winner: winner});
}

//todo make this a post
// because its not idempotent
app.get('/make', function(req, res){
  if(!req.query.username){
    res.redirect('/');
  }
  var code = generateGame();
  var [privateId, publicId] = addUserToGame(code, res, req.query.username);
  if(req.query.format == 'json'){
    res.json({publicId: publicId, privateId: privateId, gameId: code});
  }else{
    res.redirect(`/game/${code}`);
  }
});

app.get('/join', function(req, res){
  logger.log("verbose", "join game redirect");
  //todo: convey errors to user
  if(!(req.query.code)){
    logger.log("debug", 'no code supplied');
    res.redirect('/');
    return;
  }
  var code = req.query.code;
  if(!games.has(req.query.code)){
    logger.log("verbose", `Accessing invalid game: ${req.query.code}`);
    res.redirect(`/`);
    return;
  }
  var game = games.get(req.query.code);
  if(game.state != Game.states.NOT_STARTED){
    logger.log("verbose", "Attempt to join game " + req.query.code + " that has already started");
    res.redirect(`/`);
    return;
  }
  logger.log("debug", 'adding to game');
  var [privateId, publicId] = addUserToGame(req.query.code, res, req.query.username);

  if(req.query.format == 'json'){
    res.json({publicId: publicId, privateId: privateId, gameId: code});
  }else{
    res.redirect(`/game/${code}`);
  }
});

app.get('/game/:code', function(req, res){
  //todo: convey errors to user (template error page?)
  logger.log("debug", `Accessing game: ${req.params.code}`);
  if(!games.has(req.params.code)){
    logger.log("verbose", `Accessing invalid game: ${req.params.code}`);
    res.redirect(`/`);
    return;
  }
  var game = games.get(req.params.code);

  if(game.state == Game.states.FINISHED){

    if(req.query.format == "json"){
      res.json(Game.gameStateForClient(game));
      return;
    }else{
      res.sendFile(__dirname + '/public/archived.html');    
      return;  
    }
  }else if(!(game.idMapping.has(req.cookies["privateId"]))){

    res.redirect(`/?code=${req.params.code}`);
    return;
  }

  res.sendFile(__dirname + '/public/index.html');
});

function ioConnect(socket){

  // substr is to remove leading /
  var gameId = socket.nsp.name.substr(1);

  var game = games.get(gameId);

  let privateId = socket.handshake.query.privateId;
  
  //todo: allow sockets to connect in "view only" mode if they're not players
  var publicId;
  if(game.idMapping.has(privateId)){
    publicId = game.idMapping.get(privateId);
  }else{
    logger.log("verbose", `invalid privateId ${privateId}`);
    return;
  }

  logger.log("debug", "Socket connected", {publicId: publicId, gameCode: gameId});
  
  socket.emit('initialization', {gameState: Game.gameStateForClient(game), chatHistory: game.chatHistory});

  socket.on('make targets', function(msg){
    if(game.state != Game.states.NOT_STARTED){
      return;
    }
    Game.makeTargets(game, msg.gameLength, msg.countDown);
    logger.log("debug", "targets when made", {targets: Array.from(game.targets)});
    logger.log("verbose", "Making targets", {gameCode: gameId, gameState: game.state});
    // todo: say who made the targets
    socket.nsp.emit('make targets', {gameState: Game.gameStateForClient(game)});
  });

  socket.on('undo make targets', function(msg){
    if(game.state != Game.states.TARGETS_MADE){
      return;
    }
    // save gamestate before wipe
    // so we can use the settings as default values for the input fields
    var gameState = Game.gameStateForClient(game);
    Game.undoMakeTargets(game);
    socket.nsp.emit('undo make targets', {gameState: gameState});
  });

  socket.on('remove user', function(msg){
    if(game.state != Game.states.NOT_STARTED){
      return;
    }
    Game.removePlayer(game, msg.publicId);
    game.nameSpace.emit('Remove user', {publicId: msg.publicId, gameState: Game.gameStateForClient(game)});
  });

  socket.on('start game', function(msg){
    if(game.state != Game.states.TARGETS_MADE){
      return;
    }
    Game.start(game);
    logger.log("verbose", "Starting", {gameCode: gameId, gameState: game.state});
    // todo: say who started it
    socket.nsp.emit('start', {gameState: Game.gameStateForClient(game)});
  });

  socket.on('stop game', function(msg){
    if(game.state == Game.states.IN_PLAY){
      finishGame(game, 'game stopped');
      logger.log("verbose", "Stopping", {gameCode: gameId, gameState: game.state});
      // todo: say who stopped it
    }
  });

  socket.on('positionUpdate', function(position){
    Game.updatePosition(game, publicId, position);
  });

  socket.on('chat message', function(msg){
    if(game.state != Game.states.IN_PLAY){
      logger.log("debug", "chat message while not IN_PLAY");
      return;
    }

    logger.log("verbose", "Chat message", {gameCode: gameId, publicId: publicId, chatMessage: msg.text});

    var outgoing_msg = {
      publicId: publicId,
      text: msg.text,
      image: msg.image,
    }

    // snipes must contain an image
    // but not all images have to be snipes
    // for example, to send a selfie
    var wasSnipe = msg.isSnipe && msg.image && game.subState == Game.inPlaySubStates.PLAYING;

    if(wasSnipe){
      
      var snipeRes = Game.snipe(game, publicId);
      logger.log("debug", "targets", { targets: Array.from(game.targets) });
      //todo: may send request to target for current pos?
      msg.position["snipeInfo"] = snipeRes.snipeInfo;

      logger.log("debug", "targets post", {targets: Array.from(game.targets)});
      logger.log("verbose", "Snipe", {gameCode: gameId, gameState: game.state});
      if(snipeRes.gameOver){
        finishGame(game, publicId);
        return;
      }

      outgoing_msg.snipeNumber = snipeRes.snipeNumber;
      outgoing_msg.snipePlayer = publicId;
      outgoing_msg.snipeCount = snipeRes.snipeCount;
    }

    logger.log("debug", "positionUpdate", {'positionHistory': game.positions.get(publicId), 'position': msg.position});
    Game.updatePosition(game, publicId, msg.position);

    game.chatHistory.push(outgoing_msg);

    outgoing_msg.gameState = Game.gameStateForClient(game);
    
    socket.nsp.emit('chat message', outgoing_msg);
  });

  socket.on('bad snipe', function(msg){
    var undoneSnipes = Game.badSnipe(game, msg.snipePlayer, msg.snipeNumber, publicId)
    if(undoneSnipes){
      //we need to tell the client which snipes need ot be marked as canceled in the gui
      //undosnipe should probs return that
      socket.nsp.emit('bad snipe', {gameState: Game.gameStateForClient(game), snipePlayer: msg.snipePlayer, undoneSnipes: undoneSnipes});
    }
  });

  socket.on('disconnect', function(){
    logger.log('debug','socket disconnected', { 'player': publicId});
  });

}

function checkGameTiming(){
  for (let [gameId, game] of games.entries()) {
    let now = Date.now();
    //todo: need a record when we're in count down vs real game
    if (game.state == Game.states.IN_PLAY
      && game.startTime + game.gameLength < now){
      finishGame(game, 'time')
      logger.log("verbose", "TimeUp", {gameCode: gameId, gameState: game.state});
    }else if(game.state == Game.states.IN_PLAY){
      var timeLeft = game.startTime + game.countDown + game.gameLength - now;

      logger.log("debug", "timeLeft", 
        {
          gameCode: gameId,
          gameState: game.state,
          gameStartTime: game.startTime,
          gameLength: game.gameLength,
          now: now,
          timeLeft: timeLeft,
        }
      );

      game.timeLeft = timeLeft;
      var forClient = {gameState: Game.gameStateForClient(game)};
      if(game.subState == Game.inPlaySubStates.COUNTDOWN && timeLeft < game.gameLength){
        game.subState = Game.inPlaySubStates.PLAYING;
        forClient["countdownOver"] = true;
      }
      game.nameSpace.emit('timeLeft', forClient);
    }
  };
}

// The error handler must be before any other error middleware and after all controllers
app.use(Sentry.default.Handlers.errorHandler());

var connections = {}

export function startServer(){
  http.on('connection', function(conn) {
    var key = conn.remoteAddress + ':' + conn.remotePort;
    connections[key] = conn;
    conn.on('close', function() {
      logger.log("debug", 'connection close');
      delete connections[key];
    });
  });
  
  http.listen(port);
  
  setInterval(checkGameTiming, 1000)

}

export function stopServer(){
  http.close(function(){
    logger.log("debug", "Stopping server");
  });
  for (var key in connections){
    logger.log("debug", 'destroying connection');
    connections[key].destroy();
  }
}

setUpLogging('realGame');
startServer();
