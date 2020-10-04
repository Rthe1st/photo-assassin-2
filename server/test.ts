import * as gameTest from './game_test.js'
import * as socketBots from '../client/socketBots.js'
import * as Server from './server.js';
import * as Logging from './logging.js';

gameTest.basicGame();
Logging.setUpLogging('realGame');
Server.createServer();
socketBots.activeGame();
