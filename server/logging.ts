import winston from 'winston';
import * as stream from 'stream';
var Writable = stream.Writable;
export let logger;

export function setupTestLogging(filePrefix){
    // this is used in tests where you want to assert
    // what's been logger without looking in a log file
    setUpLogging(filePrefix);
    var logsForTests = [];
    var ws = new Writable({objectMode: true});
    ws._write = function (chunk, enc, next) {
        logsForTests.push(chunk);
        next();
    };
    logger.add(new winston.transports.Stream({stream: ws, level: 'verbose'}));
    logger.nextLog = function(){
        return logsForTests.shift()
    }
}

export function setUpLogging(filePrefix){
  let config = {
    level: 'info',
    format: winston.format.json(),
    defaultMeta: { service: 'game logs' },
    transports: [
      new winston.transports.File({ filename: `./logs/${filePrefix}_error.log`, level: 'error', options: { flags: 'w' } }),
      new winston.transports.File({ filename: `./logs/${filePrefix}_verbose.log`, level: 'verbose', options: { flags: 'w' } }),
      new winston.transports.File({ filename: `./logs/${filePrefix}_debug.log`, level: 'debug', options: { flags: 'w' } }),
    ]
  };
  logger = winston.createLogger(config);
}