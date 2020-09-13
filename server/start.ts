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
    // where socketclient is never used
    (async () => {
        let socketClient = await import('../client/socketBots.js');
        if (process.argv.includes("--prod")) {
            socketClient.useProd();
        } else {
            Logging.setUpLogging('realGame');
            Server.createServer();
        }

        let clientsSpecified = process.argv.indexOf("--clients")
        if (clientsSpecified == -1) {
            return;
        }
        let clientTypeIndex = clientsSpecified + 1
        if (clientTypeIndex < process.argv.length) {
            switch (process.argv[clientTypeIndex]) {
                case "active":
                    socketClient.activeGame();
                    break;
                case "passive":
                    socketClient.passiveGame();
                    break;
                case "listen":
                    socketClient.listenGame();
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
