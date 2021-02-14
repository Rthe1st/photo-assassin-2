// dosn't run because explict .js on the end of these imorts
// seems to be needed for node when running the generated js

import * as gameTest from './game_test';
import * as socketBots from './socketBots';
import * as Server from './server';
import * as Logging from './logging';

gameTest.basicGame();
Logging.setUpLogging('realGame');
Server.createServer();
socketBots.activeGame();
