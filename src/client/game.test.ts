import * as Game from "./game"
import {
  addPlayer,
  gameStateForClient,
  newGame,
  start,
  snipe,
} from "../server/game"

test("getPlayerProgress", () => {
  const serverGame = newGame("mycode")
  start(serverGame)

  const { publicId } = addPlayer(serverGame, "user1")
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
  const [got2, remaining2] = Game.getPlayerProgress(publicId)

  expect(remaining2).toEqual(0)
  expect(got2).toEqual(1)
})
