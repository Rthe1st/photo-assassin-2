import * as Server from './server.js';
import * as Logging from './logging.js';
import * as socketClient from './socketClient.js'

if(process.argv[2] == "active"){
    socketClient.activeGame();
}else if(process.argv[2] == "passive"){
    socketClient.passiveGame();
}else if(process.argv[2] == "listen"){
    socketClient.listenGame();
}else if(process.argv.length > 2){
    console.log('unrecognized arguments')
}else{
    Logging.setUpLogging('realGame');
    Server.createServer();
}