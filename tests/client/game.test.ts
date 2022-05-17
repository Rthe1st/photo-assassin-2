import * as Game from "../../src/client/game"
import {
  addPlayer,
  gameStateForClient,
  newGame,
  start,
  snipe,
} from "../../src/client/../server/game"
import { Listener } from "../../src/client/../server/socketInterface"
import { setupJestLogging } from "../../src/client/../server/logging"
import { unwrapOrThrow } from "../../src/client/../shared/utils"

function testListener(): Listener {
  return {
    listenerFactory: testListener,
    resizeDone: () => undefined,
    imageUploadDone: () => undefined,
    updateSettings: () => undefined,
    removeUser: () => undefined,
    start: () => undefined,
    chatMessage: () => undefined,
    badSnipe: () => undefined,
    newUser: () => undefined,
    finished: () => undefined,
    timeLeft: () => undefined,
  }
}

test("getPlayerProgress", () => {
  //set up
  setupJestLogging()
  const serverGame = newGame("mycode")
  serverGame.listener = testListener()
  start(serverGame)

  const { publicId } = unwrapOrThrow(addPlayer(serverGame, "user1"))
  addPlayer(serverGame, "user2")

  start(serverGame)

  let gameState = gameStateForClient(serverGame)
  Game.update(gameState)
  const [got, remaining] = Game.getPlayerProgress(publicId)

  expect(remaining).toEqual(1)
  expect(got).toEqual(0)

  snipe(serverGame, publicId, 0)

  gameState = gameStateForClient(serverGame)
  Game.update(gameState)
  // actual test
  const [got2, remaining2] = Game.getPlayerProgress(publicId)

  expect(remaining2).toEqual(0)
  expect(got2).toEqual(1)
})
