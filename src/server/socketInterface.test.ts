import { jest } from "@jest/globals"
import { addPlayer, gameStateForClient, generateGame } from "./game"
import { setupJestLogging } from "./logging"
import { testListener } from "./server.test"
import { socketConnect } from "./socketInterface"

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
    console.log(game.idMapping)
    const socket: any = makeSocket(privateId)

    const io: any = {}
    socketConnect(socket, game, io)
    expect(socket.emit).toBeCalledWith("initialization", {
      chatHistory: game.chatHistory,
      gameState: gameStateForClient(game),
    })
    expect(socket.disconnect).not.toHaveBeenCalled
  })

  it("rejects invalid private ids", () => {
    const socket: any = makeSocket()
    const game: any = {}
    const io: any = {}
    socketConnect(socket, game, io)
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
    const io: any = {}
    socketConnect(socket, game, io)
    expect(socket.emit).toBeCalledWith(
      "error",
      expect.objectContaining({
        privateId: "Failed constraint check for string: id didn't exist",
      })
    )
    expect(socket.disconnect).toBeCalled
  })
})
