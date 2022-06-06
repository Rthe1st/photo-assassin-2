import * as Game from "../../src/server/game"
import * as fs from "fs"
import * as logging from "../../src/server/logging"
import dotenv from "dotenv"
import { testListener } from "./server.test"
import { unwrapOrThrow } from "../../src/shared/utils"
import { left, right } from "fp-ts/lib/Either"

test("basic game", async () => {
  dotenv.config()
  logging.setupJestLogging()
  const game = Game.newGame("fake-game-code")
  game.listener = testListener()
  const { publicId } = unwrapOrThrow(Game.addPlayer(game, "player1"))
  Game.removePlayer(game, publicId)
  const { publicId: publicId2 } = unwrapOrThrow(Game.addPlayer(game, "player2"))
  unwrapOrThrow(Game.addPlayer(game, "player3"))
  unwrapOrThrow(Game.addPlayer(game, "player4"))
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
  const photo = fs.readFileSync("./tests/server/sample_snipe_image.jpeg")
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
  Game.finishGame(game, publicId.toString())
})

describe("updateSettings", () => {
  it("succeeds", () => {
    const game = Game.generateGame(testListener)
    unwrapOrThrow(Game.addPlayer(game, "a username"))
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
    unwrapOrThrow(Game.addPlayer(game, "username1"))
    unwrapOrThrow(Game.addPlayer(game, "username2"))
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
    unwrapOrThrow(Game.addPlayer(game, "username1"))
    unwrapOrThrow(Game.addPlayer(game, "username2"))
    unwrapOrThrow(Game.addPlayer(game, "username3"))
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

describe("addPlayer", () => {
  it("errors if too many players", () => {
    const game = Game.generateGame(testListener)
    for (
      let numberOfPlayers = 0;
      numberOfPlayers <= Game.maxPlayers;
      numberOfPlayers++
    ) {
      unwrapOrThrow(Game.addPlayer(game, `username${numberOfPlayers}`))
    }
    expect(Game.addPlayer(game, "usernameOverLimit")).toEqual(
      left(new Error(`game has 10, cannot add any more`))
    )
  })

  it("errors if username is empty", () => {
    const game = Game.generateGame(testListener)
    expect(Game.addPlayer(game, "")).toEqual(
      left(
        new Error(
          `You cannot use '' as a username, it is mandatory and must be less then 50 characters long.`
        )
      )
    )
  })

  it("errors if username is too long", () => {
    const game = Game.generateGame(testListener)
    const username = "a".repeat(Game.maxUsernameLength + 1)
    expect(Game.addPlayer(game, username)).toEqual(
      left(
        new Error(
          `You cannot use '${username}' as a username, it is mandatory and must be less then 50 characters long.`
        )
      )
    )
  })
})

describe("removePlayer", () => {
  it("removes the correct player", () => {
    const game = Game.generateGame(testListener)
    unwrapOrThrow(Game.addPlayer(game, "player1"))
    unwrapOrThrow(Game.addPlayer(game, "player2"))
    const removedPublicId = 0
    const result = Game.removePlayer(game, removedPublicId)
    expect(result).toEqual(right(undefined))
    expect(game.listener?.removeUser).toBeCalledWith({
      publicId: removedPublicId,
      gameState: expect.objectContaining({
        userList: { 1: { username: "player2" } },
      }),
    })
    expect(Array.from(game.userList.entries())).toEqual([
      [1, { username: "player2" }],
    ])
  })
  it("fails if the game has already started", () => {
    const game = Game.generateGame(testListener)
    unwrapOrThrow(Game.addPlayer(game, "player1"))
    Game.start(game)
    const result = Game.removePlayer(game, 0)
    expect(result).toEqual(left(new Error("game already started")))
    expect(game.listener?.removeUser).toBeCalledTimes(0)
    expect(game.userList.size).toEqual(1)
  })

  it("fails if no player has the public ID", () => {
    const game = Game.generateGame(testListener)
    const badPublicId = 0
    const result = Game.removePlayer(game, badPublicId)
    expect(result).toEqual(
      left(new Error(`No player with public ID ${badPublicId}`))
    )
    expect(game.listener?.removeUser).toBeCalledTimes(0)
  })
})

describe("start", () => {
  it("starts the game", () => {
    const game = Game.generateGame(testListener)
    const result = Game.start(game)
    expect(result).toEqual(right(undefined))
    expect(game.listener?.start).toBeCalledTimes(1)
    expect(game.state).toEqual(Game.states.IN_PLAY)
    expect(game.targets).toBeDefined
    expect(game.targetsGot).toBeDefined
  })

  it("fails to start if the game is in the wrong state", () => {
    const game = Game.generateGame(testListener)
    const callsFromFirstStart = 1
    Game.start(game)
    Game.finishGame(game, "")
    expect(game.listener?.start).toBeCalledTimes(callsFromFirstStart)
    const result = Game.start(game)
    expect(result).toEqual(
      left(new Error(`cannot start a game in state ${game.state}`))
    )
    expect(game.listener?.start).toBeCalledTimes(callsFromFirstStart)
    expect(game.state).toEqual(Game.states.FINISHED)
    expect(game.targets).toBeUndefined
    expect(game.targetsGot).toBeUndefined
  })
})

describe("finish", () => {
  it("finishes the game", () => {
    const game = Game.generateGame(testListener)
    unwrapOrThrow(Game.start(game))
    const winner = "arbitrary string"
    const result = Game.finishGame(game, winner)
    expect(result).toEqual(right(undefined))
    expect(game.state).toEqual(Game.states.FINISHED)
    expect(game.subState).toBe(undefined)
    expect(game.winner).toEqual(winner)
    expect(game.listener?.finished).toBeCalledTimes(1)
  })
  it(`errors if the game state is not currently ${Game.states.IN_PLAY}`, () => {
    const game = Game.generateGame(testListener)
    const result = Game.finishGame(game, "arbitrary string")
    expect(result).toEqual(left(new Error("game has wrong state")))
    expect(game.listener?.finished).toBeCalledTimes(0)
  })
})
