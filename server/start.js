import * as Server from './server.js';
import * as Logging from './logging.js';
import dotenv from 'dotenv'
import * as fs from 'fs'

// .env file doesn't exist in prod
if (fs.existsSync('.env')) {
  dotenv.config()
}

if(process.env.NODE_ENV == "production"){
    Logging.setUpLogging('realGame');
    Server.createServer();
}else{
    if(!process.argv.includes("--no-server")){
        Logging.setUpLogging('realGame');
        Server.createServer();
    }
    
    // wrap in an async so we can dynamically import socketClient
    // which means we don't need to install dev dependencies in production
    // where socketclient is never used
    (async () => {
        let socketClient = await import('./socketClient.js');
        if(process.argv.includes("--prod")){
            socketClient.useProd();
        }

        let clientTypeIndex = process.argv.indexOf("--clients") + 1

        if(clientTypeIndex < process.argv.length){
            if(process.argv[clientTypeIndex] == "active"){
                socketClient.activeGame();
            }else if(process.argv[2] == "passive"){
                socketClient.passiveGame();
            }else if(process.argv[2] == "listen"){
                socketClient.listenGame();
            }else{
                console.log('unrecognized arguments');
            }
        }else{
            console.log('no client type');
        }
    })();
}
