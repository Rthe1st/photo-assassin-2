var cookieParser = require('cookie-parser');
const express = require('express');
var app = express();
const crypto = require('crypto');
app.use(cookieParser());
var http = require('http').Server(app);
// https://github.com/socketio/socket.io/issues/2276
// (would probably be solved if we bumped socket io version)
var io = require('socket.io')(http, { cookie: false });

var winston = require('winston');
var Writable = require('stream').Writable;

var logs_for_tests = [];

function nextLog(){
  return logs_for_tests.shift();
}

exports.nextLog = nextLog;

var logger;

function setUpLogging(filePrefix){
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

exports.setUpLogging = setUpLogging;
var port = process.env.PORT || 3000;

exports.port = port;

app.use('/static', express.static(__dirname + '/public'));

function makeTargets(game, gameLength, countDown){
  if(!isNaN(parseInt(gameLength))){
    game.gameLength = parseInt(gameLength) * 1000;
  }else{
    game.gameLength = 1000*60*5;//5 min game by default
  }

  if(!isNaN(parseInt(countDown))){
    game.countDown = parseInt(countDown) * 1000;
  }else{
    game.countDown = 1000*60;//1 min countdown by default
  }

  var users = Array.from(game.userList.keys());
  for(var i=0; i<users.length;i++){
    game.targets[users[i]] =users.slice(i+1).concat(users.slice(0,i));
    game.targetsGot[users[i]] = [];
  }
  game.state = TARGETS_MADE;
}

function start(game){
  game.startTime = Date.now();
  game.state = IN_PLAY;
  if(game.countDown){
    game.subState = COUNTDOWN;
  }else{
    game.subState = PLAYING;
  }
}

function snipe(game, sniperId){
  //todo: let people vote on wether this is a valid snipe
  var targets = game.targets[sniperId];
  //targets[0] becomes the new target
  game.targetsGot[sniperId].push(targets.shift());
  if(targets.length == 0){
    return true;
  }else{
    return false;
  }
}

//todo: handle making and joining games here

app.get('/', function(req, res){
  res.sendFile(__dirname + '/public/lobby.html');
});

var games = new Map();

//game state
var FINISHED = "FINISHED";
var NOT_STARTED = "NOT STARTED";
var TARGETS_MADE = "TARGETS MADE";
var IN_PLAY = "IN PLAY";

// substates
// inplay:
var COUNTDOWN = "COUNTDOWN";
var PLAYING = "PLAYING";

exports.NOT_STARTED = NOT_STARTED;
exports.TARGETS_MADE = TARGETS_MADE;
exports.IN_PLAY = IN_PLAY;

function gameStateForClient(game){
  state = {
    userList: Object.fromEntries(game.userList.entries()),
    targets: game.targets,
    targetsGot: game.targetsGot,
    gameLength: game.gameLength,
    countDown: game.countDown,
    timeLeft: game.timeLeft,
    state: game.state,
    subState: game.subState,
    winner: game.winner,
    nextCode: game.nextCode,
    //we don't include chathistory here
    // because it could be large and is wasteful to
    // send often
  }

  if(game.state == FINISHED) {
    state["positions"] = Object.fromEntries(game.positions.entries());
  }

  return state;

}

// public ID cannot change, username might be changed by user
function addPlayer(game, privateId, publicId, username){
  game.idMapping.set(privateId,publicId);
  game.userList.set(publicId,{username: username});
  game.positions.set(publicId, []);
  
}

function addUserToGame(code, res, username){
    var game = games.get(code);

    var randomness = crypto.randomBytes(256).toString('hex');
    var publicId = game.idMapping.size;
    // including publicId because its guaranteed to be unique
    // todo: is this true even if people leave the game?
    var privateId = `${randomness}-${publicId}`;

    addPlayer(game, privateId, publicId, username);

    game.nameSpace.emit('New user', {publicId: publicId, gameState: gameStateForClient(game)});

    // todo: set good settings (https only, etc)
    res.cookie("gameId", code, {sameSite: "strict"});
    res.cookie("privateId", privateId, {sameSite: "strict"});
    res.cookie("publicId", publicId, {sameSite: "strict"});
    logger.log("verbose", "Adding user to game", {publicId: publicId, gameCode: code});
}

function newGame(nameSpace){
  return {
    nameSpace: nameSpace,
    state: NOT_STARTED,
    //substate is used for dividing the in play state in countdown and playing, for example
    subState: undefined,
    // this maps the private ID given to a client via a cookie
    // to an ID that is shown to other players
    // if other players learn your private ID, they can impersonate you
    idMapping: new Map(),
    userList: new Map(),
    targets: {},
    targetsGot: {},
    positions: new Map(),
    startTime: undefined,
    gameLength: undefined,
    countDown: undefined,
    timeLeft: undefined,
    nextCode: undefined,
    // this includes images and so will get huge
    // todo: make client smart so it only requests those its missing
    // / saves what its already seen to local storage
    // and consider off loading images to cdn
    chatHistory: [],
  };

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
  games.set(code, newGame(nameSpace));
  logger.log("verbose", "making game", {gameCode: code});
  return code;
}

/*
when a game ends this function should be responsible for
1) Generating the next game, and messagine the code back to placers
  (so they can join it easily)
2) saving the data from the game into a form you can use to review it
  (this should then be sent back to players / accessible from a link)

winner can be the winning players publicId, 'time' if the clock ran out, or undefined if game was stopped manually
  */
function finishGame(game, winner){
  game.state = FINISHED;
  game.subState = undefined;
  var nextCode = generateGame();
  game.nameSpace.emit('game finished', {nextCode: nextCode, winner: winner});
  game.winner = winner;
  game.nextCode = nextCode;
  // logger.log("verbose", "Winner", {gameCode: gameId, gameState: game.state});
}

app.get('/make', function(req, res){
  // if(maybeRedirectToExistingGame(req.cookies, res)){
  //   return;
  // }
  var code = generateGame();
  addUserToGame(code, res, req.query.username);
  res.redirect(`/game/${code}`);
});

app.get('/join', function(req, res){
  // don't do this
  // because if user hits/game/:code(and the game exists) we should assume they are trying to
  // leave an old game and join this one
  // maybeRedirectToExistingGame(req.cookies, res);

  logger.log("verbose", "join game redirect");
  //instead of this, we should show them a form to enter username in
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
  if(game.state != NOT_STARTED){
    logger.log("verbose", "Attempt to join game " + req.query.code + " that has already started");
    res.redirect(`/`);
    return;
  }
  logger.log("debug", 'adding to game');
  addUserToGame(req.query.code, res, req.query.username);
  res.redirect(`/game/${code}`);
});

app.get('/game/:code', function(req, res){
  logger.log("debug", `Accessing game: ${req.params.code}`);
  if(!games.has(req.params.code)){
    logger.log("verbose", `Accessing invalid game: ${req.params.code}`);
    res.redirect(`/`);
    return;
  }
  var game = games.get(req.params.code);

  if(game.state == FINISHED){

    if(req.query.format == "json"){
      res.json(gameStateForClient(game));
      return;
    }else{
      res.sendFile(__dirname + '/public/archived.html');    
      return;  
    }
  }

  if(!(game.idMapping.has(req.cookies["privateId"]))){

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
  
  socket.emit('initialization', {gameState: gameStateForClient(game), chatHistory: game.chatHistory});

  socket.on('make targets', function(msg){
    if(game.state != NOT_STARTED){
      return;
    }
    makeTargets(game, msg.gameLength, msg.countDown);
    logger.log("debug", "targets when made", {targets: Array.from(game.targets)});
    logger.log("verbose", "Making targets", {gameCode: gameId, gameState: game.state});
    // todo: say who made the targets
    socket.nsp.emit('make targets', {gameState: gameStateForClient(game)});
  });

  socket.on('start game', function(msg){
    if(game.state != TARGETS_MADE){
      return;
    }
    start(game);
    logger.log("verbose", "Starting", {gameCode: gameId, gameState: game.state});
    // todo: say who started it
    socket.nsp.emit('start', {gameState: gameStateForClient(game)});
  });

  socket.on('stop game', function(msg){
    if(game.state == IN_PLAY){
      finishGame(game, 'game stopped');
      logger.log("verbose", "Stopping", {gameCode: gameId, gameState: game.state});
      // todo: say who stopped it
    }
  });

  socket.on('positionUpdate', function(position){
    if(
      position.hasOwnProperty('longitude')
      && position.hasOwnProperty('latitude')
      && position.longitude != null
      && position.latitude != null
      && game.state == IN_PLAY
    ){
      game.positions.get(publicId).push(position);
    }

  });

  socket.on('chat message', function(msg){
    if(game.state != IN_PLAY){
      logger.log("debug", "chat message while not IN_PLAY");
      return;
    }

    logger.log("verbose", "Chat message", {gameCode: gameId, publicId: publicId, chatMessage: msg.text});

    logger.log("debug", "positionUpdate", {'positionHistory': game.positions.get(publicId), 'position': msg.position});

    if(
      msg.position.hasOwnProperty('longitude')
      && msg.position.hasOwnProperty('latitude')
      && msg.position.longitude != null
      && msg.position.latitude != null
    ){
      game.positions.get(publicId).push(msg.position);
    }
    var botMessage;

    // snipes must contain an image
    // but not all images have to be snipes
    // for example, to send a selfie
    if(msg.isSnipe && msg.image && game.subState == PLAYING){
      logger.log("debug", "targets", {targets: Array.from(game.targets)});
      var usernameWhoDidSniping = game.userList.get(publicId).username;
      var usernameThatGotSniped = game.userList.get(game.targets[publicId][0]).username;
      botMessage = usernameWhoDidSniping + " sniped " + usernameThatGotSniped;

      gameOver = snipe(game, publicId);
      logger.log("debug", "targets post", {targets: Array.from(game.targets)});
      logger.log("verbose", "Snipe", {gameCode: gameId, gameState: game.state});
      if(gameOver){
        finishGame(game, publicId);
        return;
      }
    }

    var outgoing_msg = {
      publicId: publicId,
      text: msg.text,
      image: msg.image,
      botMessage: botMessage,
    }

    game.chatHistory.push(outgoing_msg);

    outgoing_msg.gameState = gameStateForClient(game);
    
    socket.nsp.emit('chat message', outgoing_msg);
  });
  socket.on('disconnect', function(){
    logger.log('debug','socket disconnected', { 'player': publicId});
  });

}

function checkGameTiming(){
  for (let [gameId, game] of games.entries()) {
    let now = Date.now();
    //todo: need a record when we're in count down vs real game
    if (game.state == IN_PLAY
      && game.startTime + game.gameLength < now){
      finishGame(game, 'time')
      logger.log("verbose", "TimeUp", {gameCode: gameId, gameState: game.state});
    }else if(game.state == IN_PLAY){
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
      var forClient = {gameState: gameStateForClient(game)};
      if(game.subState == COUNTDOWN && timeLeft < game.gameLength){
        game.subState = PLAYING;
        forClient["countdownOver"] = true;
      }
      game.nameSpace.emit('timeLeft', forClient);
    }
  };
}

var connections = {}

function startServer(){
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

function stopServer(){
  http.close(function(){
    logger.log("debug", "Stopping server");
  });
  for (var key in connections){
    logger.log("debug", 'destroying connection');
    connections[key].destroy();
  }
}


if (require.main === module) {
  setUpLogging('realGame');
  startServer();
}

exports.startServer = startServer;
exports.stopServer = stopServer;
