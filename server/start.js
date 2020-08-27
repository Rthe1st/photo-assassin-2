import * as Server from './server.js';

import * as Logging from './logging.js';

//todo: use test logger if we're in test mode
Logging.setUpLogging('realGame');

Server.createServer();