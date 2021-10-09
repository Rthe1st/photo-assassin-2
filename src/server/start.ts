import * as Server from "./server"
import * as Logging from "./logging"

if (process.env.NODE_ENV == "production") {
  Logging.setUpLogging("realGame")
  Server.createServer()
} else {
  // todo: I'm not sure comment below this is good logic
  // if it's for tests only, put it in test code explicitly
  // if it might be useful on the server, should always be installed

  // wrap in an async so we can dynamically import socketClient
  // which means we don't need to install dev dependencies in production
  // where socketClient is never used
  ;(async () => {
    // we need an explicit extension here as typescript-transformer-append-js-extension doesn't recognize dynamic imports
    const socketClient = await import("./socketBots.js")
    const gameCodeSpecified = process.argv.indexOf("--game-code")
    if (process.argv.includes("--prod")) {
      socketClient.useProd()
    } else if (gameCodeSpecified == -1) {
      // if game code specified, server must already be running
      Logging.setUpLogging("realGame")
      Server.createServer()
    }

    const clientsSpecified = process.argv.indexOf("--clients")
    if (clientsSpecified == -1) {
      return
    }
    const clientTypeIndex = clientsSpecified + 1

    let gameCode
    if (gameCodeSpecified != -1 && gameCodeSpecified < process.argv.length) {
      gameCode = process.argv[gameCodeSpecified + 1]
    }

    if (clientTypeIndex < process.argv.length) {
      switch (process.argv[clientTypeIndex]) {
        case "active":
          socketClient.activeGame()
          break
        case "passive":
          socketClient.passiveGame(gameCode)
          break
        case "listen":
          socketClient.listenGame(gameCode)
          break
        case "gps":
          socketClient.gpsGame(gameCode)
          break
        default:
          console.log("unrecognized arguments")
          break
      }
    } else {
      console.log("no client type")
    }
  })()
}
