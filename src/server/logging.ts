import winston from "winston"
import * as stream from "stream"
const Writable = stream.Writable
export let logger: winston.Logger // & {nextLog():string};

export function setupJestLogging() {
  const config = {
    level: "info",
    format: winston.format.json(),
    defaultMeta: { service: "game logs" },
    transports: [new winston.transports.Console()],
    // transports: [
    //   new winston.transports.File({ filename: `./logs/${filePrefix}_error.log`, level: 'error', options: { flags: 'w' } }),
    //   new winston.transports.File({ filename: `./logs/${filePrefix}_verbose.log`, level: 'verbose', options: { flags: 'w' } }),
    //   new winston.transports.File({ filename: `./logs/${filePrefix}_debug.log`, level: 'debug', options: { flags: 'w' } }),
    // ]
  }
  logger = winston.createLogger(config)
  // logger.nextLog = function(){
  //   return logsForTests.shift()
  // }
}

export function setupTestLogging(filePrefix: string) {
  // this is used in tests where you want to assert
  // what's been logger without looking in a log file
  setUpLogging(filePrefix)
  const logsForTests: string[] = []
  const ws = new Writable({ objectMode: true })
  ws._write = function (chunk, _, next) {
    logsForTests.push(chunk)
    next()
  }
  logger.add(new winston.transports.Stream({ stream: ws, level: "verbose" }))
  // disabled because it's not used yet and hard to make work with typescript
  // logger.nextLog = function(){
  //     return logsForTests.shift()
  // }
}

export function setUpLogging(filePrefix = "general") {
  const config = {
    level: "info",
    format: winston.format.json(),
    defaultMeta: { service: "game logs" },
    transports: [
      new winston.transports.File({
        filename: `./logs/${filePrefix}_error.log`,
        level: "error",
        options: { flags: "w" },
      }),
      new winston.transports.File({
        filename: `./logs/${filePrefix}_verbose.log`,
        level: "verbose",
        options: { flags: "w" },
      }),
      new winston.transports.File({
        filename: `./logs/${filePrefix}_debug.log`,
        level: "debug",
        options: { flags: "w" },
      }),
    ],
  }
  logger = winston.createLogger(config)
  // logger.nextLog = function(){
  //   return logsForTests.shift()
  // }
}
