// purpose of this is for testing the server
// and allowing AI opponents
// without the need for a browser

import * as socketClient from "../shared/socketClient"
import fetch from "node-fetch"
import fs from "fs"
import randomSeed from "random-seed"
import * as SharedGame from "../shared/game"
import * as https from "https"
import { Socket } from "socket.io-client"

export let domain = "https://localhost:3000"

export function useProd(): void {
  domain = "https://photo-assassin.prangten.com"
}

export async function getData(url: string) {
  const agent = new https.Agent({
    rejectUnauthorized: false,
  })
  const response = await fetch(url, { agent })
  const json = await response.json()
  return json
}

export async function makeGame(
  username: string,
  host: string = domain
): Promise<any> {
  const agent = new https.Agent({
    rejectUnauthorized: false,
  })
  const url = `${host}/make`
  const requestOptions = {
    method: "POST",
    agent: agent,
    body: `username=${username}&format=json`,
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
  }
  const response = await fetch(url, requestOptions)
  return response.json()
}

export async function joinGame(
  username: string,
  gameId: string,
  host: string = domain
): Promise<any> {
  const url = `${host}/join`
  const agent = new https.Agent({
    rejectUnauthorized: false,
  })
  const requestOptions = {
    method: "POST",
    agent: agent,
    body: `code=${gameId}&username=${username}&format=json`,
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
  }

  return (await fetch(url, requestOptions)).json()
}

interface Player {
  name: string
  algo: (
    gameId: string,
    privateId: string,
    player: Player,
    publicId: number
  ) => Socket
  position: SharedGame.Position
}

async function gameSetup(players: Player[], gameId: string | undefined) {
  if (players.length == 0) {
    console.log("no players supplied")
    return
  }
  let hostPlayer: Player | undefined
  let details

  const wasGamePremade = gameId != undefined
  if (!wasGamePremade) {
    hostPlayer = players.shift()!
    details = await makeGame(hostPlayer.name)
    gameId = details.gameId
    console.log(`https://localhost:3000/game/${gameId}`)
  }
  const sockets = new Map()
  for (const player of players) {
    const details = await joinGame(player.name, gameId!)
    const socket = player.algo(
      details.gameId,
      details.privateId,
      player,
      details.publicId
    )
    sockets.set(details.publicId, socket)
  }
  if (!wasGamePremade) {
    const socket = hostPlayer!.algo(
      details.gameId,
      details.privateId,
      hostPlayer!,
      details.publicId
    )
    sockets.set(details.publicId, socket)
  }
}

function activePlayer(gameId: string, privateId: string, player: Player) {
  const randomGenerator = randomSeed.create("seedvalue")
  const socket = socketClient.setup(
    gameId,
    privateId,
    (msg) => {
      console.log("init")
      if (Object.entries(msg.gameState.userList).length > 1) {
        socketClient.startGame(socket, {
          gameLength: 60000,
          countDown: 0,
          proposedTargetList: msg.gameState.chosenSettings.proposedTargetList,
        })
      }
    },
    () => {
      //todo
    },
    () => {
      //todo
    },
    (_) => {
      //todo
    },
    () => {
      //todo
    },
    (_) => {
      console.log("start")
      const file = fs.readFileSync("./src/server/sample_snipe_image.jpeg")
      const message = {
        text: "gotya",
        image: file,
        position: {
          longitude: player.position.longitude,
          latitude: player.position.latitude,
          //todo: mock these more correctly
          accuracy: 1,
          heading: 0,
          speed: 1,
          timestamp: Date.now(),
          altitude: 0,
          altitudeAccuracy: 1,
        },
        isSnipe: true,
        //we don't care about this
        nonce: 1,
      }
      socketClient.chatMessage(socket, message)
    },
    () => {
      console.log("game over")
    },
    () => {
      //todo
    },
    (_) => {
      player.position.latitude! += (Math.random() - 0.5) * 0.001
      player.position.longitude! += (Math.random() - 0.5) * 0.001
      const file = fs.readFileSync("./src/server/sample_snipe_image.jpeg")
      const message = {
        text: "gotya",
        image: file,
        position: {
          longitude: player.position.longitude,
          latitude: player.position.latitude,
          accuracy: null,
          heading: null,
          speed: null,
          timestamp: null,
          altitude: null,
          altitudeAccuracy: null,
        },
        isSnipe: randomGenerator(100) > 50,
        //we don't care about this
        nonce: 1,
      }
      socketClient.chatMessage(socket, message)
    },
    () => {
      //todo
    },
    () => {
      //todo
    },
    domain
  )
  return socket
}

function passivePlayer(gameId: string, privateId: string, player: Player) {
  const socket = socketClient.setup(
    gameId,
    privateId,
    () => {
      console.log("passive init")
    },
    () => {
      //todo
    },
    () => {
      //todo
    },
    () => {
      //todo
    },
    () => {
      //todo
    },
    () => {
      //todo
    },
    () => {
      //todo
    },
    () => {
      //todo
    },
    (_) => {
      player.position.latitude! += (Math.random() - 0.5) * 0.001
      player.position.longitude! += (Math.random() - 0.5) * 0.001
      socketClient.positionUpdate(socket, {
        longitude: player.position.longitude,
        latitude: player.position.latitude,
        accuracy: null,
        heading: null,
        speed: null,
        timestamp: null,
        altitude: null,
        altitudeAccuracy: null,
      })
    },
    () => {
      //todo
    },
    () => {
      //todo
    },
    domain
  )
  return socket
}

function listeningPlayer(
  gameId: string,
  privateId: string,
  player: Player,
  publicId: number
) {
  //this is incase we re-connect and miss messagesfile
  let commandsSeen = 0

  function processCommand(msg: any) {
    player.position.latitude! += (Math.random() - 0.5) * 0.001
    player.position.longitude! += (Math.random() - 0.5) * 0.001
    const parts = msg.text.split(" ")
    const command = parts[0]
    const name = parts[1]
    if (name == player.name || name == "all") {
      console.log(command)
      console.log(name)
      if (command == "snipe") {
        console.log("sniping")
        const file = fs.readFileSync("./src/server/sample_snipe_image.jpeg")
        const message = {
          text: "gotya",
          image: file,
          position: {
            longitude: player.position.longitude,
            latitude: player.position.latitude,
            accuracy: null,
            heading: null,
            speed: null,
            timestamp: null,
            altitude: null,
            altitudeAccuracy: null,
          },
          isSnipe: true,
          //we don't care about this
          nonce: 1,
        }
        socketClient.chatMessage(socket, message)
      } else if (command == "move") {
        console.log("moving")
        player.position.latitude! += (Math.random() - 0.5) * 0.001
        player.position.longitude! += (Math.random() - 0.5) * 0.001
        socketClient.positionUpdate(socket, {
          longitude: player.position.longitude,
          latitude: player.position.latitude,
          accuracy: null,
          heading: null,
          speed: null,
          timestamp: null,
          altitude: null,
          altitudeAccuracy: null,
        })
      } else if (command == "picture") {
        console.log("pictureing")
        const file = fs.readFileSync("./src/server/sample_snipe_image.jpeg")
        const message = {
          text: "picture",
          image: file,
          position: {
            longitude: player.position.longitude,
            latitude: player.position.latitude,
            accuracy: null,
            heading: null,
            speed: null,
            timestamp: null,
            altitude: null,
            altitudeAccuracy: null,
          },
          isSnipe: false,
          //we don't care about this
          nonce: 1,
        }
        socketClient.chatMessage(socket, message)
      } else if (command == "message") {
        console.log("messging")
        const message: socketClient.ClientChatMessage = {
          text: "blahblah",
          position: {
            longitude: player.position.longitude,
            latitude: player.position.latitude,
            accuracy: null,
            heading: null,
            speed: null,
            timestamp: null,
            altitude: null,
            altitudeAccuracy: null,
          },
          image: undefined,
          isSnipe: undefined,
          //we don't care about this
          nonce: 1,
        }
        socketClient.chatMessage(socket, message)
      } else if (command == "badsnipe" && parts.length == 3) {
        console.log("badsniping")
        const msg: socketClient.ClientBadSnipe = {
          snipeInfosIndex: parts[2],
        }
        socketClient.badSnipe(socket, msg)
      }
      // it's important this is only logged after we know the action was sent
      commandsSeen += 1
    }
  }

  const socket = socketClient.setup(
    gameId,
    privateId,
    (msg) => {
      console.log("init:")
      console.log(player)
      let commandsInHistory = 0
      for (const message of msg.chatHistory) {
        const parts = message.text.split(" ")
        if (parts.length < 2) {
          continue
        }
        const name = parts[1]
        if (name == player.name || name == "all") {
          commandsInHistory += 1
          if (commandsInHistory > commandsSeen) {
            console.log("replaying")
            console.log(message.text)
            commandsSeen += 1
            processCommand(message)
          }
        }
      }
    },
    () => {
      //todo
    },
    (msg) => {
      //remove user
      if (msg.publicId == publicId) {
        socket.close()
      }
    },
    (_) => {
      //todo
    },
    () => {
      //todo
    },
    (_) => {
      console.log("start")
      console.log("start move")
      player.position.latitude! += (Math.random() - 0.5) * 0.001
      player.position.longitude! += (Math.random() - 0.5) * 0.001
      socketClient.positionUpdate(socket, {
        longitude: player.position.longitude,
        latitude: player.position.latitude,
        accuracy: null,
        heading: null,
        speed: null,
        timestamp: null,
        altitude: null,
        altitudeAccuracy: null,
      })
    },
    () => {
      console.log("game over")
    },
    () => {
      //todo
    },
    processCommand,
    () => {
      //todo
    },
    () => {
      //todo
    },
    domain
  )
  return socket
}

export async function activeGame() {
  await gameSetup(
    [
      {
        name: "simpleSloth",
        algo: activePlayer,
        position: {
          longitude: 0.012,
          latitude: 51.389,
          accuracy: null,
          heading: null,
          speed: null,
          timestamp: null,
          altitude: null,
          altitudeAccuracy: null,
        },
      },
      {
        name: "p1",
        algo: passivePlayer,
        position: {
          longitude: 0.012,
          latitude: 51.389,
          accuracy: null,
          heading: null,
          speed: null,
          timestamp: null,
          altitude: null,
          altitudeAccuracy: null,
        },
      },
      {
        name: "p2",
        algo: passivePlayer,
        position: {
          longitude: 0.012,
          latitude: 51.389,
          accuracy: null,
          heading: null,
          speed: null,
          timestamp: null,
          altitude: null,
          altitudeAccuracy: null,
        },
      },
      {
        name: "p3",
        algo: passivePlayer,
        position: {
          longitude: 0.012,
          latitude: 51.389,
          accuracy: null,
          heading: null,
          speed: null,
          timestamp: null,
          altitude: null,
          altitudeAccuracy: null,
        },
      },
    ],
    undefined
  )
}

export function passiveGame(gameCode?: string) {
  gameSetup(
    [
      {
        name: "p1",
        algo: passivePlayer,
        position: {
          longitude: 0.012,
          latitude: 51.389,
          accuracy: null,
          heading: null,
          speed: null,
          timestamp: null,
          altitude: null,
          altitudeAccuracy: null,
        },
      },
      {
        name: "p2",
        algo: passivePlayer,
        position: {
          longitude: 0.012,
          latitude: 51.389,
          accuracy: null,
          heading: null,
          speed: null,
          timestamp: null,
          altitude: null,
          altitudeAccuracy: null,
        },
      },
      {
        name: "p3",
        algo: passivePlayer,
        position: {
          longitude: 0.012,
          latitude: 51.389,
          accuracy: null,
          heading: null,
          speed: null,
          timestamp: null,
          altitude: null,
          altitudeAccuracy: null,
        },
      },
      {
        name: "simpleSloth",
        algo: passivePlayer,
        position: {
          longitude: 0.012,
          latitude: 51.389,
          accuracy: null,
          heading: null,
          speed: null,
          timestamp: null,
          altitude: null,
          altitudeAccuracy: null,
        },
      },
    ],
    gameCode
  )
}

export function listenGame(gameCode?: string) {
  gameSetup(
    [
      {
        name: "p1",
        algo: listeningPlayer,
        position: {
          longitude: 0.012,
          latitude: 51.389,
          accuracy: null,
          heading: null,
          speed: null,
          timestamp: null,
          altitude: null,
          altitudeAccuracy: null,
        },
      },
      {
        name: "p2",
        algo: listeningPlayer,
        position: {
          longitude: 0.012,
          latitude: 51.389,
          accuracy: null,
          heading: null,
          speed: null,
          timestamp: null,
          altitude: null,
          altitudeAccuracy: null,
        },
      },
      {
        name: "p3",
        algo: listeningPlayer,
        position: {
          longitude: 0.012,
          latitude: 51.389,
          accuracy: null,
          heading: null,
          speed: null,
          timestamp: null,
          altitude: null,
          altitudeAccuracy: null,
        },
      },
      {
        name: "simpleSloth",
        algo: listeningPlayer,
        position: {
          longitude: 0.012,
          latitude: 51.389,
          accuracy: null,
          heading: null,
          speed: null,
          timestamp: null,
          altitude: null,
          altitudeAccuracy: null,
        },
      },
    ],
    gameCode
  )
}

function gpsPlayer(gameId: string, privateId: string, _: Player) {
  const socket = socketClient.setup(
    gameId,
    privateId,
    (msg) => {
      console.log("init, starting")
      const gpsData = JSON.parse(
        fs.readFileSync("./src/server/gps_test_data.json", "utf8")
      )
      const gameLength =
        gpsData[gpsData.length - 1]["timestamp"] - gpsData[0]["timestamp"]
      socketClient.startGame(socket, {
        gameLength: gameLength,
        countDown: 0,
        proposedTargetList: msg.gameState.chosenSettings.proposedTargetList,
      })
    },
    () => {
      //todo
    },
    () => {
      //todo
    },
    () => {
      //todo
    },
    () => {
      //todo
    },
    (_) => {
      console.log("started")
      const gpsData = JSON.parse(fs.readFileSync("gps_test_data.json", "utf8"))
      for (const position of gpsData) {
        socketClient.positionUpdate(socket, position)
      }
      socketClient.stopGame(socket)
    },
    () => {
      //todo
    },
    () => {
      //todo
    },
    () => {
      //todo
    },
    () => {
      //todo
    },
    () => {
      //todo
    },
    domain
  )
  return socket
}

export function gpsGame(gameCode?: string) {
  gameSetup(
    [
      {
        name: "p1",
        algo: gpsPlayer,
        position: {
          longitude: 0.012,
          latitude: 51.389,
          accuracy: null,
          heading: null,
          speed: null,
          timestamp: null,
          altitude: null,
          altitudeAccuracy: null,
        },
      },
      {
        name: "p2",
        algo: passivePlayer,
        position: {
          longitude: 0.012,
          latitude: 51.389,
          accuracy: null,
          heading: null,
          speed: null,
          timestamp: null,
          altitude: null,
          altitudeAccuracy: null,
        },
      },
    ],
    gameCode
  )
}
