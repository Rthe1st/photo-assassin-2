import * as gameTest from './game_test.js'
import * as socketClient from '../client/socketClient.js'
import * as Server from './server.js';
import * as Logging from './logging.js';

gameTest.basicGame();
Logging.setUpLogging('realGame');
Server.createServer();
socketClient.activeGame();
