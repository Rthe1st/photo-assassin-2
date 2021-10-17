import * as socketClient from "./socketBots"
import { exit } from "process"
import { domain } from "./socketBots"

const gameCodeSpecified = process.argv.indexOf("--game-code")
if (process.argv.includes("--prod")) {
  socketClient.useProd()
}

console.log(`Bots connecting to: ${domain}`)

const clientsSpecified = process.argv.indexOf("--clients")
if (clientsSpecified == -1) {
  console.log("no clients specifed")
  exit()
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
