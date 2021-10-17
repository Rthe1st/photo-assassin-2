import { jest } from "@jest/globals"
// needed for messy socket tests that don't clean themselves up well
jest.setTimeout(10000)
import * as socketHelpers from "./socketHelpers"
import * as socketBots from "../src/server/socketBots"
import { domain, gameCodeFormat } from "./shared_definitions"

test("whole game", async () => {
  let details = await socketBots.makeGame("hostplayer", domain)
  const { socket: player1, msg: initMessage } = await socketHelpers.makeSocket(
    domain,
    details.gameId,
    details.privateId
  )

  expect(initMessage).toMatchObject({
    gameState: expect.anything(),
    chatHistory: [],
  })

  const gameId = details.gameId
  details = await socketBots.joinGame("passiveplayer", gameId!, domain)
  const { socket: player2, msg: initMessage2 } = await socketHelpers.makeSocket(
    domain,
    details.gameId,
    details.privateId
  )

  expect(initMessage2).toMatchObject({
    gameState: expect.anything(),
    chatHistory: [],
  })

  const gameSettings = {
    gameLength: 60000,
    countDown: 0,
    proposedTargetList: [0, 1],
  }

  const msg = await socketHelpers.startGame(player1, gameSettings)
  const expectedGameState = {
    chosenSettings: {
      countDown: 0,
      gameLength: 60000,
      proposedTargetList: [0, 1],
    },
    latestSnipeIndexes: [],
    snipeInfos: [],
    state: "IN PLAY",
    subState: "PLAYING",
    targets: {
      "0": [1],
      "1": [0],
    },
    targetsGot: { "0": [], "1": [] },
    userList: {
      "0": {
        username: "hostplayer",
      },
      "1": {
        username: "passiveplayer",
      },
    },
  }
  expect(msg).toMatchObject({ gameState: expectedGameState })
  const finishedMsg = await socketHelpers.stopGame(player1)
  expect(finishedMsg).toMatchObject({
    nextCode: expect.stringMatching(new RegExp(gameCodeFormat)),
    winner: "game stopped",
  })

  await socketHelpers.closeSockets([player1, player2])
})
