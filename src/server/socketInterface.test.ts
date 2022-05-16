import { jest } from "@jest/globals"
import { unwrapOrThrow } from "../shared/utils"
import { addPlayer, gameStateForClient, generateGame } from "./game"
import { setupJestLogging } from "./logging"
import { testListener } from "./server.test"
import {
  receiveUpdateSettings,
  removeUser,
  socketConnect,
} from "./socketInterface"

setupJestLogging()

describe("socketConnect", () => {
  const makeSocket = (privateId?: string, socketId?: string) => ({
    handshake: {
      query: {
        privateId,
      },
    },
    emit: jest.fn(),
    disconnect: jest.fn(),
    on: jest.fn(),
    id: socketId,
  })

  it("accepts valid id", () => {
    const game = generateGame(testListener)
    const { privateId } = unwrapOrThrow(addPlayer(game, "user"))
    const socket: any = makeSocket(privateId, "fakeSocketId")

    const saveSocketIds = jest.fn()
    socketConnect(socket, game, saveSocketIds)
    expect(socket.emit).toBeCalledWith("initialization", {
      chatHistory: game.chatHistory,
      gameState: gameStateForClient(game),
    })
    expect(saveSocketIds).toBeCalledWith(0, "fakeSocketId")
    expect(socket.disconnect).not.toHaveBeenCalled
  })

  it("rejects invalid private ids", () => {
    const socket: any = makeSocket()
    const game: any = {}
    const saveSocketIds = jest.fn()
    socketConnect(socket, game, saveSocketIds)
    expect(socket.emit).toBeCalledWith(
      "error",
      expect.objectContaining({
        privateId: "Expected string, but was undefined",
      })
    )
    expect(socket.disconnect).toBeCalled
    expect(saveSocketIds).toBeCalledTimes(0)
  })

  it("rejects invalid private ids", () => {
    const socket: any = makeSocket("not a real id")
    const game = generateGame(testListener)
    const saveSocketIds = jest.fn()
    socketConnect(socket, game, saveSocketIds)
    expect(socket.emit).toBeCalledWith(
      "error",
      expect.objectContaining({
        privateId: "Failed constraint check for string: id didn't exist",
      })
    )
    expect(socket.disconnect).toBeCalled
    expect(saveSocketIds).toBeCalledTimes(0)
  })
})

describe("receiveUpdateSettings", () => {
  it("works with valid settings", () => {
    const socket: any = {
      emit: jest.fn(),
    }
    const game = generateGame(testListener)
    receiveUpdateSettings(socket, game, {
      gameLength: 10,
      countDown: 5,
      proposedTargetList: [],
    })
    expect(socket.emit).toBeCalledTimes(0)
  })

  it("errors when msg is missing fields", () => {
    const socket: any = {
      emit: jest.fn(),
    }
    const game = generateGame(testListener)
    receiveUpdateSettings(socket, game, {})
    expect(socket.emit).toBeCalledWith(
      "error",
      expect.objectContaining({
        countDown: "Expected number, but was missing",
        gameLength: "Expected number, but was missing",
        proposedTargetList: "Expected number[], but was missing",
      })
    )
  })

  it("errors when msg fields have the wrong type", () => {
    const socket: any = {
      emit: jest.fn(),
    }
    const game = generateGame(testListener)
    receiveUpdateSettings(socket, game, {
      countDown: "not a number",
      gameLength: "not a number",
      proposedTargetList: ["not a number"],
    })
    expect(socket.emit).toBeCalledWith(
      "error",
      expect.objectContaining({
        countDown: "Expected number, but was string",
        gameLength: "Expected number, but was string",
        proposedTargetList: ["Expected number, but was string"],
      })
    )
  })

  it("errors when update settings call fails", () => {
    const socket: any = {
      emit: jest.fn(),
    }
    const game = generateGame(testListener)
    receiveUpdateSettings(socket, game, {
      countDown: -1,
      gameLength: -1,
      proposedTargetList: [0],
    })
    expect(socket.emit).toBeCalledWith(
      "error",
      expect.objectContaining({
        countDown: "Failed constraint check for is more then 0",
        gameLength: "Failed constraint check for is more then 0",
        proposedTargetList:
          "Failed constraint check for matches number of players in game",
      })
    )
  })
})

describe("removePlayer", () => {
  it("no error emitted for valid calls", () => {
    const socket: any = {
      emit: jest.fn(),
    }
    const game = generateGame(testListener)
    addPlayer(game, "player1")
    removeUser({ publicId: 0 }, game, socket)
    expect(socket.emit).toBeCalledTimes(0)
  })

  it("errors if game logic fails", () => {
    const socket: any = {
      emit: jest.fn(),
    }
    const game = generateGame(testListener)
    removeUser({ publicId: 0 }, game, socket)
    expect(socket.emit).toBeCalledWith("error", "No player with public ID 0")
  })

  it("errors if publicId is missing fields", () => {
    const socket: any = {
      emit: jest.fn(),
    }
    const game = generateGame(testListener)
    removeUser({}, game, socket)
    expect(socket.emit).toBeCalledWith(
      "error",
      expect.objectContaining({
        publicId: "Expected number, but was missing",
      })
    )
  })

  it("errors if publicId is the wrong type", () => {
    const socket: any = {
      emit: jest.fn(),
    }
    const game = generateGame(testListener)
    removeUser({ publicId: "not a number" }, game, socket)
    expect(socket.emit).toBeCalledWith(
      "error",
      expect.objectContaining({
        publicId: "Expected number, but was string",
      })
    )
  })
})
