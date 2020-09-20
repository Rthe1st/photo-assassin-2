import * as Server from './server.js';
import * as Logging from './logging.js';
import dotenv from 'dotenv'
import * as fs from 'fs'

// .env file doesn't exist in prod
if (fs.existsSync('.env')) {
    dotenv.config()
}

if (process.env.NODE_ENV == "production") {
    Logging.setUpLogging('realGame');
    Server.createServer();
} else {
    // wrap in an async so we can dynamically import socketClient
    // which means we don't need to install dev dependencies in production
    // where socketClient is never used
    (async () => {
        let socketClient = await import('../client/socketBots.js');
        let gameCodeSpecified = process.argv.indexOf("--game-code")
        if (process.argv.includes("--prod")) {
            socketClient.useProd();
        } else if (gameCodeSpecified == -1){
            // if game code specified, server must already be running
            Logging.setUpLogging('realGame');
            Server.createServer();
        }

        let clientsSpecified = process.argv.indexOf("--clients")
        if (clientsSpecified == -1) {
            return;
        }
        let clientTypeIndex = clientsSpecified + 1

        let gameCode
        if (gameCodeSpecified != -1 && gameCodeSpecified < process.argv.length) {
            gameCode = process.argv[gameCodeSpecified + 1]
        }
        if (clientTypeIndex < process.argv.length) {
            switch (process.argv[clientTypeIndex]) {
                case "active":
                    socketClient.activeGame();
                    break;
                case "passive":
                    socketClient.passiveGame(gameCode);
                    break;
                case "listen":
                    socketClient.listenGame(gameCode);
                    break;
                default:
                    console.log('unrecognized arguments');
                    break;
            }
        } else {
            console.log('no client type');
        }
    })();
}
