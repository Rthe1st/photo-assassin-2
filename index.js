var app = require('express')();
var http = require('http').Server(app);
var io = require('socket.io')(http);
var port = process.env.PORT || 3000;

var targets = {}

function makeTargets(userList){
  users = Object.keys(userList);
  console.log(users);
  for(var i=0; i<users.length;i++){
    console.log(users[i]);
    targets[users[i]] = users[(i+1)%users.length];
  }
}

app.get('/', function(req, res){
  res.sendFile(__dirname + '/index.html');
});

var gameStarted = false;
var startTime;
var gameLength;
var targetsMade = false;

//todo: remove users when they leave
//or give admin option to remove
var userList = {}

io.on('connection', function(socket){
  io.emit('chat message', {'text': 'a user joined'});
  socket.on('chat message', function(msg){

    if(msg.username != '' && !(msg.username in userList)){
      userList[msg.username] = true;
    }
    msg.userList = userList;
    console.log(msg);
    if(!gameStarted && msg.text == "@maketargets"){
      console.log("maket");
      makeTargets(userList);
      msg.targets = targets;
      targetsMade = true;
    }else if(targetsMade && !gameStarted && msg.text.startsWith("@start")){
      startTime = Date.now();
      textParts = msg.text.split(" ")
      if(textParts.length > 1 && !isNaN(parseInt(textParts[1]))){
        gameLength = 1000*60*parseInt(textParts[1]);
      }else{
        gameLength = 1000*60*5;//5 min game by default
      }
      console.log("started");
      gameStarted = true;
    }else if(gameStarted && msg.text == "@snipe" && msg.username in targets){
      console.log("snipe");
      //todo: let people vote on wether this is a valid snipe
      var oldTarget = targets[msg.username];
      var newTarget = targets[oldTarget];
      if(newTarget == msg.username){
        msg.winner = msg.username;
        targets = {}
        gameStarted = false;
        targetsMade = false;
      }else{
        targets[msg.username] = newTarget;
        msg.targets = targets;
      }
    }
    //todo: don't rely on messages for checking timing
    if(gameStarted && startTime + gameLength < Date.now()){
      gameStarted = false;
      targetsMade = false;
      msg.winner = "The relentless passage of time";
    }else if(gameStarted){
      msg.timeLeft =  (startTime + gameLength) - Date.now();
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
