var cookieParser = require('cookie-parser');
var app = require('express')();
const crypto = require('crypto');
app.use(cookieParser());
var http = require('http').Server(app);
var io = require('socket.io')(http);
var port = process.env.PORT || 3000;

function makeTargets(game){
  var userList = game.userList;
  var users = Object.keys(userList);
  console.log("making targets");
  for(var i=0; i<users.length;i++){
    game.targets[users[i]] = users[(i+1)%users.length];
  }
  game.state = TARGETS_MADE;
}

function start(game, msgText){
  game.startTime = Date.now();
  textParts = msgText.split(" ")
  if(textParts.length > 1 && !isNaN(parseInt(textParts[1]))){
    gameLength = 1000*60*parseInt(textParts[1]);
  }else{
    gameLength = 1000*60*5;//5 min game by default
  }
  console.log("started");
  game.state = IN_PLAY;
}

function snipe(game, sniperId){
  console.log("snipe");
  //todo: let people vote on wether this is a valid snipe
  var oldTarget = game.targets[sniperId];
  var newTarget = game.targets[oldTarget];
  if(newTarget == sniperId){
    return true;
  }else{
    game.targets[msg.username] = newTarget;
    return false;
  }
}

function maybeRedirectToExistingGame(cookies){
  // you can only be part of one game at a time
  // to if user is already in one, keep redirecting
  // till they leave it
  if(cookies["gameId"] in games
    && cookies["userId"] in games.userList){
      console.log(`Redirect userId ${userId} to gameId ${gameId}`);
      res.redirect(__dirname + '/index.html');
  }
}

//todo: handle making and joining games here

app.get('/', function(req, res){
  maybeRedirectToExistingGame(req.cookies);
  res.sendFile(__dirname + '/lobby.html');
});

var games = {}

//game state
var NOT_STARTED = "NOT STARTED";
var TARGETS_MADE = "TARGETS MADE";
var IN_PLAY = "IN PLAY";


function new_game(userList){
  return {
    state: NOT_STARTED,
    // todo: give admin option to remove
    userList: userList,
    targets: {},
    startTime: undefined,
    gameLength: undefined,
  };

}

app.get('/make', function(req, res){
  maybeRedirectToExistingGame(req.cookies);

  var first_part = crypto.randomBytes(2).toString('hex');
  var second_part = crypto.randomBytes(2).toString('hex');
  // used number of games as a guarantee prevent collisions
  // (even though collisions must be unlikely anyway for the code to provide security)
  var third_part = Object.keys(games).length.toString(16);
  const code = `${first_part}-${second_part}-${third_part}`;
  console.log(`making game: ${code}`);
  games[code] = new_game({});
  res.redirect(`/game/${code}`);
});

app.get('/join', function(req, res){
  maybeRedirectToExistingGame(req.cookies);

  if('code' in req.query){
    var code = req.query.code;
    res.redirect(`/game/${code}`);
  }else{
    res.redirect(`/`);
  }
});

app.get('/game/:code', function(req, res){

  // don't do this
  // because if user hits/game/:code we should assume they are tyring to
  // leave an old game and join this one
  // maybeRedirectToExistingGame(req.cookies);

  if(!req.params.code in games){
    console.log(`Accessing invalid game: ${req.params.code}`)
    res.redirect(`/`);
  }else{

    var game = games[req.params.code];

    if(!(req.cookies["userId"] in game.userList)){

      if(game.state != NOT_STARTED){
        console.log("Attempt to join game " + req.params.code + " that has already started");
        res.redirect(`/`);
      }

      var randomness = crypto.randomBytes(256).toString('hex');
      var uniqueness = Object.keys(game.userList).length;
      var idToken = `${randomness}-${uniqueness}`;

      game.userList[idToken] = {};
      // todo: should we sign these? Not much need really
      // does signing make horizontal scaling more painful?
      res.cookie("gameId", req.params.code);
      res.cookie("userId", idToken);
      console.log(`Adding userId ${idToken} to game ${req.params.code}`);
      res.sendFile(__dirname + '/index.html');
    }else{
      console.log(`Adding userId ${req.cookies["userId"]} rejoining game ${req.params.code}`);
      res.sendFile(__dirname + '/index.html');
    }
  }
});

io.on('connection', function(socket){

  let gameId = socket.handshake.query.gameId;
  if(gameId in games){
    socket.gameId = gameId;
  }else{
    console.log(`invalid game code ${socket.gameId}`);
    return;
  }

  var game = games[gameId];

  let userId = socket.handshake.query.userId;
  if(userId in game.userList){
    socket.userId = userId;
  }else{
    console.log(`invalid userId ${socket.userId}`);
    return;
  }

  console.log(`UserId ${userId} connected socket for ${gameId}`);
  
  io.emit('chat message', {'text': 'a user joined'});
  socket.on('chat message', function(msg){

    console.log(`gameId: ${gameId}, userId: ${userId}, username: ${msg.username}, message: ${msg.text}`)

    console.log(game.state);

    //todo: save this onto users cookie/userId dict
    if(msg.username != '' && game.state == NOT_STARTED){
      game.userList[socket.userId].username = msg.username;
    }else if(game.userList[socket.userId].username != msg.username){
      console.log("attempted to set username for "  + socket.userId + " to " + msg.username + " but state != NOT_STARTED");
    }
    msg.userList = game.userList;
    console.log(msg);
    if(game.state == NOT_STARTED && msg.text == "@maketargets"){
      makeTargets(game);
      msg.targets = game.targets;
    }else if(game.state == TARGETS_MADE && msg.text.startsWith("@start")){
      start(game, msg.text);
    }else if(game.state == IN_PLAY && msg.text == "@snipe"){
      gameOver = snipe(game, socket.userId);
      if(gameOver){
        console.log("winner");
        games[gameId] = game = new_game(game.userList);
        msg.winner = socket.userId;
      }
    }
    //todo: don't rely on messages events to check timing
    if(game.state == IN_PLAY){
      if(game.startTime + game.gameLength < Date.now()){
        game.state = NOT_STARTED;
        msg.winner = "The relentless passage of time";
      }else{
        msg.timeLeft =  (game.startTime + game.gameLength) - Date.now();
      }
    }
    
    io.emit('chat message', msg);
  });
  socket.on('disconnect', function(){
    io.emit('chat message',{'text': 'a user left'});
    console.log('user disconnected');
  });
});

http.listen(port, function(){
  console.log('listening on *:' + port);
});
