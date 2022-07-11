import { jest } from "@jest/globals"
import { unwrapOrThrow } from "../../src/shared/utils"
import {
  addPlayer,
  Game,
  gameStateForClient,
  generateGame,
  start,
} from "../../src/server/game"
import { setupJestLogging } from "../../src/server/logging"
import { testListener } from "./server.test"
import {
  receiveUpdateSettings,
  removeUser,
  removeUserCallback,
  socketConnect,
  socketListener,
  stop,
} from "../../src/server/socketInterface"
import { Namespace, Server } from "socket.io"
import { RemoveUserMsg, ServerBadSnipeMsg } from "../../src/shared/socketEvents"

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

describe("removeUser", () => {
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

describe("stop", () => {
  it("no error emitted for valid calls", () => {
    const socket: any = {
      emit: jest.fn(),
    }
    const game = generateGame(testListener)
    unwrapOrThrow(addPlayer(game, "player1"))
    unwrapOrThrow(start(game))

    stop(game, socket)
    expect(socket.emit).toBeCalledTimes(0)
  })

  it("errors if game logic fails", () => {
    const socket: any = {
      emit: jest.fn(),
    }
    const game = generateGame(testListener)
    stop(game, socket)
    expect(socket.emit).toBeCalledWith("error", "game has wrong state")
  })
})

describe("socketListener", () => {
  it("constructs a listener", () => {
    const namespace = {
      emit: jest.fn(),
      on: jest.fn(),
    }

    const io = {
      of: jest.fn(() => namespace),
    } as unknown as Server
    const game = jest.fn() as unknown as Game
    const code = "code"
    const listener = socketListener(io, code, game)
    expect(namespace.on).toBeCalledWith("connection", expect.any(Function))
    expect(io.of).toBeCalledWith(`/game/${code}`)
    const msg = {} as unknown as ServerBadSnipeMsg
    listener.badSnipe(msg)
    expect(namespace.emit).toBeCalledWith("bad snipe", msg)
  })
  describe("listenerFactory", () => {
    it("creates a correct listener", () => {
      const namespace = {
        emit: jest.fn(),
        on: jest.fn(),
      }

      const io = {
        of: jest.fn(() => namespace),
      } as unknown as Server

      const game = jest.fn() as unknown as Game
      const code = "code"

      const listener = socketListener(io, code, game)
      const game2 = jest.fn() as unknown as Game
      const code2 = "code2"
      listener.listenerFactory(code2, game2)
      expect(namespace.on).toBeCalledWith("connection", expect.any(Function))
      expect(io.of).toBeCalledWith(`/game/${code2}`)
    })
  })
})

describe("removeUserCallback", () => {
  it("disconnects their socket", () => {
    const mockDisconnect = jest.fn()
    const socketGetMock = jest.fn(() => {
      return {
        disconnect: mockDisconnect,
      }
    })
    const mockNamespace = {
      emit: jest.fn(),
      sockets: {
        get: socketGetMock,
      },
    } as unknown as Namespace

    const code = "code"

    const removeUserMsg = { publicId: 0 } as unknown as RemoveUserMsg
    const socketIdMappings = new Map([[0, "socketId"]])
    removeUserCallback(removeUserMsg, socketIdMappings, code, mockNamespace)
    expect(mockNamespace.emit).toBeCalledWith("Remove user", {
      publicId: 0,
    })
    expect(mockNamespace.sockets.get).toBeCalledWith("socketId")
    expect(mockDisconnect).toBeCalled()
  })
  it("fails gracefully if socket mapping not found", () => {
    const mockNamespace = {
      emit: jest.fn(),
    } as unknown as Namespace

    const code = "code"

    const publicId = "0"

    const removeUserMsg = { publicId } as unknown as RemoveUserMsg
    const socketIdMappings = new Map()
    removeUserCallback(removeUserMsg, socketIdMappings, code, mockNamespace)
    expect(mockNamespace.emit).toBeCalledWith(
      "error",
      `No socket found for player ${publicId} when removing them`
    )
    expect(mockNamespace.emit).toBeCalledWith("Remove user", {
      publicId,
    })
  })
})
