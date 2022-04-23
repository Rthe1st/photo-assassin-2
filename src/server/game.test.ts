import * as Game from "./game"
import * as fs from "fs"
import * as logging from "./logging"
import dotenv from "dotenv"
import { testListener } from "./server.test"

test("basic game", async () => {
  dotenv.config()
  logging.setupJestLogging()
  const game = Game.newGame("fake-game-code")
  game.listener = testListener()
  const { publicId: publicId } = Game.addPlayer(game, "player1")
  Game.removePlayer(game, publicId)
  const { publicId: publicId2 } = Game.addPlayer(game, "player2")
  Game.addPlayer(game, "player3")
  Game.addPlayer(game, "player4")
  Game.updateSettings(game, 40, 5, game.chosenSettings!.proposedTargetList)
  Game.start(game)
  const position = {
    longitude: 1,
    latitude: 1,
    accuracy: null,
    heading: null,
    speed: null,
    timestamp: null,
    altitude: null,
    altitudeAccuracy: null,
  }
  Game.updatePosition(game, publicId2, position)
  const photo = fs.readFileSync("./src/server/sample_snipe_image.jpeg")
  const {
    imageId: imageId1,
    imagePromise: ip,
    resizePromise: resizePromise,
  } = Game.saveImage(game, photo)

  await ip
  await resizePromise

  const { snipeInfo: snipeInfo } = Game.snipe(game, publicId2, imageId1)
  // publicId2 is undoing their own snipe
  const undoneSnipes = Game.badSnipe(game, snipeInfo.index, publicId2)
  expect(undoneSnipes).toEqual([0])
  const { imageId: imageId2 } = Game.saveImage(game, photo)
  let snipeRes = Game.snipe(game, publicId2, imageId2)
  const { imageId: imageId3 } = Game.saveImage(game, photo)
  snipeRes = Game.snipe(game, publicId2, imageId3)
  expect(snipeRes.gameOver).toBeTruthy()
  Game.finishGame(game, "made-up-code", publicId.toString())
})

describe("updateSettings", () => {
  it("succeeds", () => {
    const game = Game.generateGame(testListener)
    Game.addPlayer(game, "a username")
    const result = Game.updateSettings(game, 2, 1, [0])
    expect(result.success).toBe(true)
    expect(game.chosenSettings).toMatchObject({
      gameLength: 2,
      countDown: 1,
      proposedTargetList: [0],
    })
    expect(game.listener!.updateSettings).toBeCalledWith({
      gameState: expect.objectContaining({
        chosenSettings: {
          gameLength: 2,
          countDown: 1,
          proposedTargetList: [0],
        },
      }),
    })
  })

  it("countDown is negative", () => {
    const game = Game.generateGame(testListener)
    const result = Game.updateSettings(game, 2, -1, [])
    expect(result).toMatchObject({
      success: false,
      details: { countDown: "Failed constraint check for is more then 0" },
    })
  })

  it("countDown is as big as game length", () => {
    const game = Game.generateGame(testListener)
    const result = Game.updateSettings(game, 2, 2, [])
    expect(result).toMatchObject({
      success: false,
      details: {
        countDown: "Failed constraint check for less then game length",
      },
    })
  })

  it("countDown is not an integer", () => {
    const game = Game.generateGame(testListener)
    const result = Game.updateSettings(game, 2, 0.1, [])
    expect(result).toMatchObject({
      success: false,
      details: {
        countDown: "Failed constraint check for is integer",
      },
    })
  })

  it("gameLength is negative", () => {
    const game = Game.generateGame(testListener)
    const result = Game.updateSettings(game, 1, -1, [])
    expect(result).toMatchObject({
      success: false,
      details: { countDown: "Failed constraint check for is more then 0" },
    })
  })

  it("gameLength is not an integer", () => {
    const game = Game.generateGame(testListener)
    const result = Game.updateSettings(game, 2.1, 1, [])
    expect(result).toMatchObject({
      success: false,
      details: {
        gameLength: "Failed constraint check for is integer",
      },
    })
  })

  it("gameLength is too big", () => {
    const game = Game.generateGame(testListener)
    const result = Game.updateSettings(game, 61, 1, [])
    expect(result).toMatchObject({
      success: false,
      details: {
        gameLength: "Failed constraint check for is less then or equal to 60",
      },
    })
  })

  it("has the wrong game state", () => {
    const game = Game.generateGame(testListener)
    game.state = Game.states.IN_PLAY
    const result = Game.updateSettings(game, 61, 1, [])
    expect(result).toMatchObject({
      success: false,
      details: {
        gameState: "Failed constraint check for game stats is NOT_STARTED",
      },
    })
  })

  it("has wrong proposedTargetList size", () => {
    const game = Game.generateGame(testListener)
    const result = Game.updateSettings(game, 61, 1, [1])
    expect(result).toMatchObject({
      success: false,
      details: {
        proposedTargetList: [
          "Failed constraint check for less then or equal to max player ID",
        ],
      },
    })
  })

  it("has duplicate targets in proposedTargetList", () => {
    const game = Game.generateGame(testListener)
    Game.addPlayer(game, "username1")
    Game.addPlayer(game, "username2")
    const result = Game.updateSettings(game, 2, 1, [1, 1])
    expect(result).toMatchObject({
      success: false,
      details: {
        proposedTargetList: "Failed constraint check for no duplicate targets",
      },
    })
  })

  it("has bad targets in proposedTargetList", () => {
    const game = Game.generateGame(testListener)
    Game.addPlayer(game, "username1")
    Game.addPlayer(game, "username2")
    Game.addPlayer(game, "username3")
    const result = Game.updateSettings(game, 61, 1, [-1, 0.1, 5])
    expect(result).toMatchObject({
      success: false,
      details: {
        proposedTargetList: [
          "Failed constraint check for is 0 or more",
          "Failed constraint check for is integer",
          "Failed constraint check for less then or equal to max player ID",
        ],
      },
    })
  })
})
