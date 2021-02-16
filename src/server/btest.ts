// dosn't run because explict .js on the end of these imorts
// seems to be needed for node when running the generated js

import * as socketBots from './socketBots';
import * as Server from './server';
import * as Logging from './logging';

Logging.setUpLogging('realGame');
Server.createServer();
// todo: replace this with a api_test integration jest test
socketBots.activeGame();
