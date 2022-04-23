import { jest } from "@jest/globals"
import { addPlayer, gameStateForClient, generateGame } from "./game"
import { setupJestLogging } from "./logging"
import { testListener } from "./server.test"
import { receiveUpdateSettings, socketConnect } from "./socketInterface"

setupJestLogging()

describe("socketConnect", () => {
  const makeSocket = (privateId?: string) => ({
    handshake: {
      query: {
        privateId,
      },
    },
    emit: jest.fn(),
    disconnect: jest.fn(),
    on: jest.fn(),
  })

  it("accepts valid id", () => {
    const game = generateGame(testListener)
    const { privateId } = addPlayer(game, "user")
    const socket: any = makeSocket(privateId)

    socketConnect(socket, game)
    expect(socket.emit).toBeCalledWith("initialization", {
      chatHistory: game.chatHistory,
      gameState: gameStateForClient(game),
    })
    expect(socket.disconnect).not.toHaveBeenCalled
  })

  it("rejects invalid private ids", () => {
    const socket: any = makeSocket()
    const game: any = {}
    socketConnect(socket, game)
    expect(socket.emit).toBeCalledWith(
      "error",
      expect.objectContaining({
        privateId: "Expected string, but was undefined",
      })
    )
    expect(socket.disconnect).toBeCalled
  })

  it("rejects invalid private ids", () => {
    const socket: any = makeSocket("not a real id")
    const game = generateGame(testListener)
    socketConnect(socket, game)
    expect(socket.emit).toBeCalledWith(
      "error",
      expect.objectContaining({
        privateId: "Failed constraint check for string: id didn't exist",
      })
    )
    expect(socket.disconnect).toBeCalled
  })
})

describe("receiveUpdateSettings", () => {
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
