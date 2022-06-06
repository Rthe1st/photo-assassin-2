import { jest } from "@jest/globals"
// needed for messy socket tests that don't clean themselves up well
jest.setTimeout(10000)
import * as socketHelpers from "./socketHelpers"
import * as socketBots from "../src/bots/socketBots"
import { domain } from "./shared_definitions"

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
    gameLength: 60,
    countDown: 1,
    proposedTargetList: [0, 1],
  }
  const msg = await socketHelpers.updateSettings(player1, gameSettings)
  const expectedGameState = {
    chosenSettings: {
      countDown: 1,
      gameLength: 60,
      proposedTargetList: [0, 1],
    },
    latestSnipeIndexes: [],
    snipeInfos: [],
    state: "NOT STARTED",
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
  await socketHelpers.startGame(player1)
  const finishedMsg = await socketHelpers.stopGame(player1)
  expect(finishedMsg).toMatchObject({
    winner: "game stopped",
  })
  await socketHelpers.closeSockets([player1, player2])
})
