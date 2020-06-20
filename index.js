var cookieParser = require('cookie-parser');
var app = require('express')();
const crypto = require('crypto');
app.use(cookieParser());
var http = require('http').Server(app);
var io = require('socket.io')(http);

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

function makeTargets(game){
  var users = Array.from(game.userList.keys());
  for(var i=0; i<users.length;i++){
    game.targets[users[i]] = users[(i+1)%users.length];
  }
  game.state = TARGETS_MADE;
}

function start(game, msgText){
  game.startTime = Date.now();
  textParts = msgText.split(" ")
  if(textParts.length > 1 && !isNaN(parseInt(textParts[1]))){
    game.gameLength = parseInt(textParts[1]);
  }else{
    game.gameLength = 1000*60*5;//5 min game by default
  }
  game.state = IN_PLAY;
}

function snipe(game, sniperId){
  //todo: let people vote on wether this is a valid snipe
  var oldTarget = game.targets[sniperId];
  var newTarget = game.targets[oldTarget];
  if(newTarget == sniperId){
    return true;
  }else{
    game.targets[sniperId] = newTarget;
    return false;
  }
}

function maybeRedirectToExistingGame(cookies, res){
  // you can only be part of one game at a time
  // to if user is already in one, keep redirecting
  // till they leave it
  // todo: instead of redirecting, send them to a page saying
  // "you're already in game X [link], you must leave it before making a new one"
  if(games.has(cookies["gameId"])
    && games.get(cookies["gameId"]).idMapping.has(cookies["privateId"])){
      logger.log("verbose", 'Redirect to existing game', {publicId: games.get(cookies["gameId"]).idMapping.get(cookies["privateId"]), gameCode: cookies["gameId"]});
      res.redirect(`/game${cookies["gameId"]}`);
      return true;
  }
  return false;
}

//todo: handle making and joining games here

app.get('/', function(req, res){
  if(maybeRedirectToExistingGame(req.cookies, res)){
    return;
  }
  res.sendFile(__dirname + '/lobby.html');
});

var games = new Map();

//game state
var NOT_STARTED = "NOT STARTED";
var TARGETS_MADE = "TARGETS MADE";
var IN_PLAY = "IN PLAY";

exports.NOT_STARTED = NOT_STARTED;
exports.TARGETS_MADE = TARGETS_MADE;
exports.IN_PLAY = IN_PLAY;

function newGame(nameSpace, idMapping=new Map(), userList=new Map()){
  let positions = new Map();
  for(let publicId of userList.keys()){
    positions.set(publicId, [])
  }
  return {
    nameSpace: nameSpace,
    state: NOT_STARTED,
    // this maps the private ID given to a client via a cookie
    // to an ID that is shown to other players
    // if other players learn your private ID, they can impersonate you
    idMapping: idMapping,
    userList: userList,
    targets: {},
    positions: positions,
    startTime: undefined,
    gameLength: undefined,
  };

}

function addPlayer(game, privateId, publicId){
  game.idMapping.set(privateId,publicId);
  game.userList.set(publicId,{});
  game.positions.set(publicId, []);
}

app.get('/make', function(req, res){
  if(maybeRedirectToExistingGame(req.cookies, res)){
    return;
  }

  var first_part = crypto.randomBytes(2).toString('hex');
  var second_part = crypto.randomBytes(2).toString('hex');
  // used number of games as a guarantee prevent collisions
  // (even though collisions must be unlikely anyway for the code to provide security)
  var third_part = games.size.toString(16);
  const code = `/${first_part}-${second_part}-${third_part}`;
  logger.log("verbose", "making game", {gameCode: code});
  var nameSpace = io.of(code);
  nameSpace.on('connection', ioConnect);
  games.set(code, newGame(nameSpace));
  res.redirect(`/game${code}`);
});

app.get('/join', function(req, res){
  logger.log("verbose", "join game redirect");
  if(maybeRedirectToExistingGame(req.cookies, res)){
    return;
  }
  if('code' in req.query){
    var code = req.query.code;
    res.redirect(`/game${code}`);
  }else{
    res.redirect(`/`);
  }
});

app.get('/game/:code', function(req, res){

  // don't do this
  // because if user hits/game/:code we should assume they are tyring to
  // leave an old game and join this one
  // maybeRedirectToExistingGame(req.cookies, res);
  req.params.code = '/' + req.params.code;
  logger.log("debug", `Accessing game: ${req.params.code}`);
  if(!games.has(req.params.code)){
    logger.log("verbose", `Accessing invalid game: ${req.params.code}`);
    res.redirect(`/`);
  }else{

    var game = games.get(req.params.code);

    if(!(game.idMapping.has(req.cookies["privateId"]))){

      if(game.state != NOT_STARTED){
        logger.log("verbose", "Attempt to join game " + req.params.code + " that has already started");
        res.redirect(`/`);
      }

      var randomness = crypto.randomBytes(256).toString('hex');
      var publicId = game.idMapping.size;
      // including publicId because its guaranteed to be unique
      var privateId = `${randomness}-${publicId}`;

      addPlayer(game, privateId, publicId);

      // todo: set good settings (https only, etc)
      res.cookie("gameId", req.params.code, {sameSite: "strict"});
      res.cookie("privateId", privateId, {sameSite: "strict"});
      res.cookie("publicId", publicId, {sameSite: "strict"});
      logger.log("verbose", "Adding user to game", {publicId: publicId, gameCode: req.params.code});
      res.sendFile(__dirname + '/index.html');
    }else{
      logger.log("verbose", 'User rejoining game', {publicId: req.cookies["publicId"], gameCode: req.params.code});
      res.sendFile(__dirname + '/index.html');
    }
  }
});

function ioConnect(socket){

  var gameId = socket.nsp.name;

  var game = games.get(gameId);

  let privateId = socket.handshake.query.privateId;
  
  if(game.idMapping.has(privateId)){
    var publicId = game.idMapping.get(privateId);
  }else{
    logger.log("verbose", `invalid privateId ${privateId}`);
    return;
  }

  logger.log("debug", "Socket connected", {publicId: publicId, gameCode: gameId});
  
  socket.nsp.emit('chat message', {'text': `user ${publicId} joined`});
  socket.on('chat message', function(msg){
    logger.log("verbose", "Chat message", {gameCode: gameId, publicId: publicId, username: msg.username, chatMessage: msg.text});

    logger.log("debug", "positionUpdate", {'positionHistory': game.positions.get(publicId), 'position': msg.position});

    if(
      msg.position.hasOwnProperty('longitude')
      && msg.position.hasOwnProperty('latitude')
      && msg.position.longitude != null
      && msg.position.latitude != null
    ){
      game.positions.get(publicId).push(msg.position);
    }

    //todo: save this onto users cookie/publicId dict
    if(msg.username != '' && game.state == NOT_STARTED){
      game.userList.get(publicId).username = msg.username;
    }else if(game.userList.get(publicId).username != msg.username){
      logger.log("verbose", "attempted to set username for "  + publicId + " to " + msg.username + " but state != NOT_STARTED");
    }
    msg.userList = Array.from(game.userList.keys());
    if(game.state == NOT_STARTED && msg.text == "@maketargets"){
      makeTargets(game);
      logger.log("debug", "targets when made", {targets: Array.from(game.targets)});
      msg.targets = game.targets;
      logger.log("verbose", "Making targets", {gameCode: gameId, gameState: game.state});
    }else if(game.state == TARGETS_MADE && msg.text.startsWith("@start")){
      start(game, msg.text);
      logger.log("verbose", "Starting", {gameCode: gameId, gameState: game.state});
    }else if(game.state == IN_PLAY && msg.text == "@snipe"){
      logger.log("debug", "targets", {targets: Array.from(game.targets)});
      gameOver = snipe(game, publicId);
      logger.log("debug", "targets post", {targets: Array.from(game.targets)});
      logger.log("verbose", "Snipe", {gameCode: gameId, gameState: game.state});
      if(gameOver){
        games.set(gameId,newGame(game.nameSpace, game.idMapping, game.userList));
        game = games.get(gameId);
        msg.winner = publicId;
        logger.log("verbose", "Winner", {gameCode: gameId, gameState: game.state});
      }
    }
    
    socket.nsp.emit('chat message', msg);
  });
  socket.on('disconnect', function(){
    socket.nsp.emit('chat message',{'text': 'a user left'});
  });

}

function checkGameTiming(){
  for (let [gameId, game] of games.entries()) {
    let now = Date.now();
    if (game.state == IN_PLAY
      && game.startTime + game.gameLength < now){
      game.state = NOT_STARTED;
      game.nameSpace.emit({'winner': 'The relentless passage of time'});
      logger.log("verbose", "TimeUp", {gameCode: gameId, gameState: game.state});
    }else if(game.state == IN_PLAY){
      logger.log("debug", "timeLeft", 
        {
          gameCode: gameId,
          gameState: game.state,
          gameStartTime: game.startTime,
          gameLength: game.gameLength,
          now: now,
          timeLeft: (game.startTime + game.gameLength - now)
        }
      );
      game.nameSpace.emit({'timeLeft': (game.startTime + game.gameLength) - now});
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
