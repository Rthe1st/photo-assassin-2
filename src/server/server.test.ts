import { Request } from "express"
import { jest } from "@jest/globals"
import {
  apiJoin,
  apiMake,
  commonJoin,
  gamePage,
  join,
  make,
  root,
} from "./server"
import * as logging from "./logging"
import { Game, generateGame, generateGameCode, start, states } from "./game"
import { Listener } from "./socketInterface"

logging.setupJestLogging()

export function testListener(): Listener {
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

function makeMockResponse() {
  const cookies = new Map()

  return {
    mockRes: {
      status: jest.fn(),
      render: jest.fn(),
      sendFile: jest.fn(),
      redirect: jest.fn(),
      cookie: jest.fn((name, value, _settings) => {
        cookies.set(name, value)
      }),
      json: jest.fn(),
      end: jest.fn(),
    } as any,
    cookies,
  }
}

describe("gamepage", () => {
  const staticDir = "poop/"

  const makeMockRequest = (code?: string, privateId?: string) =>
    ({
      params: {
        code,
      },
      cookies: { privateId },
    } as any as Request)

  test("invalid code format", async () => {
    const badlyFormatedCode = "wrong game code format"
    const mockRequest = makeMockRequest(badlyFormatedCode)
    const mockResponse = makeMockResponse().mockRes

    gamePage(staticDir, mockRequest, mockResponse, () => undefined)
    expect(mockResponse.status).toBeCalledWith(400)
    expect(mockResponse.status).toBeCalledTimes(1)
    expect(mockResponse.render).toBeCalledWith("error", {
      layout: false,
      helpers: {
        details: `game code '${badlyFormatedCode}' is wrong, should be 4 words, for example: 'cat-dog-fish-spoon'`,
      },
    })
  })

  test("game doesn't exist (or is finished but not in memory)", async () => {
    const mockRequest = makeMockRequest(generateGameCode(1))
    const mockResponse = makeMockResponse().mockRes

    gamePage(staticDir, mockRequest, mockResponse, () => undefined)
    expect(mockResponse.sendFile).toBeCalledWith(`${staticDir}archived.html`)
  })

  test("game exists but client is not in it", async () => {
    const mockRequest = makeMockRequest(generateGameCode(1), "myprivateid")
    const mockResponse = makeMockResponse().mockRes

    gamePage(
      staticDir,
      mockRequest,
      mockResponse,
      () => ({ idMapping: new Map() } as Game)
    )
    expect(mockResponse.redirect).toBeCalledWith(
      `/?code=${mockRequest.params.code}`
    )
  })

  test("game exists and client is in it", async () => {
    const mockRequest = makeMockRequest(generateGameCode(1), "myprivateid")
    const mockResponse = makeMockResponse().mockRes

    gamePage(
      staticDir,
      mockRequest,
      mockResponse,
      () => ({ idMapping: new Map([["myprivateid", {}]]) } as Game)
    )
    expect(mockResponse.sendFile).toBeCalledWith(`${staticDir}index.html`)
  })
})

describe("root", () => {
  const staticDir = "poop/"
  const getMockRequest = (code?: string) =>
    ({
      query: {
        code,
      },
    } as any as Request)

  test("failure with invalid game code format", async () => {
    const badlyFormatedGameCode = "not a valid game code"

    const mockRequest = getMockRequest(badlyFormatedGameCode)
    const mockResponse = makeMockResponse().mockRes

    root(staticDir, mockRequest, mockResponse, () => ({} as Game))
    expect(mockResponse.status).toBeCalledWith(400)
    expect(mockResponse.status).toBeCalledTimes(1)
    expect(mockResponse.render).toBeCalledWith("error", {
      layout: false,
      helpers: {
        details: `game code '${badlyFormatedGameCode}' is wrong, should be 4 words, for example: 'cat-dog-fish-spoon'`,
      },
    })
  })

  test("failure with valid game code that doesn't exist", async () => {
    const mockRequest = getMockRequest(generateGameCode(1))
    const mockResponse = makeMockResponse().mockRes

    root(staticDir, mockRequest, mockResponse, () => undefined)
    expect(mockResponse.status).toBeCalledWith(404)
    expect(mockResponse.status).toBeCalledTimes(1)
    expect(mockResponse.render).toBeCalledWith("error", {
      layout: false,
      helpers: {
        details: `No game exists with the code '${mockRequest.query.code}'`,
      },
    })
  })

  test("failure with valid game code that doesn't exist", async () => {
    const mockRequest = getMockRequest(generateGameCode(1))
    const mockResponse = makeMockResponse().mockRes

    root(
      staticDir,
      mockRequest,
      mockResponse,
      () => ({ state: states.IN_PLAY } as Game)
    )
    expect(mockResponse.status).toBeCalledWith(403)
    expect(mockResponse.status).toBeCalledTimes(1)
    expect(mockResponse.render).toBeCalledWith("error", {
      layout: false,
      helpers: {
        details: `You can't join the game '${mockRequest.query.code}' because it has already started.`,
      },
    })
  })

  test("success with valid game code", async () => {
    const mockRequest = getMockRequest(generateGameCode(1))
    const mockResponse = makeMockResponse().mockRes

    root(
      staticDir,
      mockRequest,
      mockResponse,
      () => ({ state: states.NOT_STARTED } as Game)
    )
    expect(mockResponse.sendFile).toBeCalledWith(`${staticDir}lobby.html`)
  })

  test("success without game code", async () => {
    const mockRequest = getMockRequest()
    const mockResponse = makeMockResponse().mockRes

    root("poop/", mockRequest, mockResponse, () => undefined)
    expect(mockResponse.sendFile).toBeCalledWith(`${staticDir}lobby.html`)
  })
})

describe("make", () => {
  const makeMockRequest = (username?: string) =>
    ({
      body: {
        username,
      },
    } as any as Request)

  it("succeeds", () => {
    const mockReq = makeMockRequest("myusername")
    const { mockRes, cookies } = makeMockResponse()

    make(mockReq, mockRes, testListener)

    expect(mockRes.redirect).toBeCalledWith(
      expect.stringMatching(/\/game\/[a-z]+-[a-z]+-[a-z]+-[a-z]+$/)
    )
    expect(mockRes.cookie).toBeCalledWith("gameId", cookies.get("gameId"), {
      sameSite: "strict",
    })
    expect(mockRes.cookie).toBeCalledWith(
      "privateId",
      expect.stringMatching(/[a-f\d]+-0/),
      {
        sameSite: "strict",
      }
    )
    expect(mockRes.cookie).toBeCalledWith("publicId", 0, {
      sameSite: "strict",
    })
  })

  it("has a username that is too long", () => {
    const maxUsernameLength = 50
    const username = "a".repeat(maxUsernameLength + 1)
    const mockReq = makeMockRequest(username)
    const { mockRes } = makeMockResponse()

    make(mockReq, mockRes, testListener)

    expect(mockRes.status).toBeCalledWith(400)
    expect(mockRes.render).toBeCalledWith("error", {
      layout: false,
      helpers: {
        details: `You cannot use '${username}' as a username, it is mandatory and must be less then ${maxUsernameLength} characters long.`,
      },
    })
  })

  it("no username provided", () => {
    const mockReq = makeMockRequest()
    const { mockRes } = makeMockResponse()

    make(mockReq, mockRes, testListener)

    expect(mockRes.status).toBeCalledWith(400)
    expect(mockRes.render).toBeCalledWith("error", {
      layout: false,
      helpers: {
        details: `You cannot use '' as a username, it is mandatory and must be less then 50 characters long.`,
      },
    })
  })
  describe("api make", () => {
    it("succeeds", () => {
      const mockReq = makeMockRequest("myusername")
      const { mockRes, cookies } = makeMockResponse()

      apiMake(mockReq, mockRes, testListener)

      expect(mockRes.cookie).toBeCalledWith("gameId", cookies.get("gameId"), {
        sameSite: "strict",
      })
      expect(mockRes.cookie).toBeCalledWith(
        "privateId",
        expect.stringMatching(/[a-f\d]+-0/),
        {
          sameSite: "strict",
        }
      )
      expect(mockRes.cookie).toBeCalledWith("publicId", 0, {
        sameSite: "strict",
      })

      expect(mockRes.status).toBeCalledWith(200)
      expect(mockRes.json).toBeCalledWith({
        publicId: cookies.get("publicId"),
        privateId: cookies.get("privateId"),
        gameId: cookies.get("gameId"),
      })
      expect(mockRes.end).toBeCalledTimes(1)
    })

    it("has a username that is too long", () => {
      const maxUsernameLength = 50
      const username = "a".repeat(maxUsernameLength + 1)
      const mockReq = makeMockRequest(username)
      const { mockRes } = makeMockResponse()

      apiMake(mockReq, mockRes, testListener)

      expect(mockRes.status).toBeCalledWith(400)
      expect(mockRes.json).toBeCalledWith(
        `You cannot use '${username}' as a username, it is mandatory and must be less then ${maxUsernameLength} characters long.`
      )
      expect(mockRes.end).toBeCalledTimes(1)
    })

    it("no username provided", () => {
      const mockReq = makeMockRequest()
      const { mockRes } = makeMockResponse()

      apiMake(mockReq, mockRes, testListener)

      expect(mockRes.status).toBeCalledWith(400)
      expect(mockRes.json).toBeCalledWith(
        `You cannot use '' as a username, it is mandatory and must be less then 50 characters long.`
      )
      expect(mockRes.end).toBeCalledTimes(1)
    })
  })
})

describe("commonJoin", () => {
  it("succeeds", () => {
    const game = generateGame(testListener)

    const result = commonJoin("username", game.code)

    expect(result.success).toEqual({
      publicId: 0,
      privateId: expect.stringMatching(/[a-f\d]+-0/),
      gameId: game.code,
    })
    expect(result.error).toBeUndefined
  })

  it("username too long", () => {
    const game = generateGame(testListener)
    const maxUsernameLength = 50
    const username = "a".repeat(maxUsernameLength + 1)
    const result = commonJoin(username, game.code)

    expect(result.success).toBeUndefined
    expect(result.error).toEqual(
      `username: You cannot use '${username}' as a username, it is mandatory and must be less then ${maxUsernameLength} characters long.`
    )
  })

  it("username missing", () => {
    const game = generateGame(testListener)
    const result = commonJoin(undefined, game.code)

    expect(result.success).toBeUndefined
    expect(result.error).toEqual(
      `username: You cannot use '' as a username, it is mandatory and must be less then 50 characters long.`
    )
  })

  it("game code bad format", () => {
    const badCode = "badly formated code"
    const result = commonJoin("my username", badCode)

    expect(result.success).toBeUndefined
    expect(result.error).toEqual(
      `code: Failed constraint check for string: '${badCode}' is wrong, should be 4 words, for example: 'cat-dog-fish-spoon'`
    )
  })

  it("game code doesn't exist", () => {
    const code = generateGameCode(0)
    const result = commonJoin("my username", code)

    expect(result.success).toBeUndefined
    expect(result.error).toEqual(
      `code: Failed constraint check for string: '${code}' does not exist`
    )
  })

  it("game already started", () => {
    const game = generateGame(testListener)
    start(game)
    const result = commonJoin("my username", game.code)

    expect(result.success).toBeUndefined
    expect(result.error).toEqual(
      `code: Failed constraint check for string: '${game.code}' has already started`
    )
  })
})

describe("join", () => {
  const makeMockRequest = (username?: string, code?: string) =>
    ({
      body: {
        username,
        code,
      },
    } as any as Request)

  it("succeeds", () => {
    const game = generateGame(testListener)
    const mockReq = makeMockRequest("myusername", game.code)
    const { mockRes } = makeMockResponse()

    join(mockReq, mockRes)

    expect(mockRes.redirect).toBeCalledWith(expect.stringMatching(game.code))
    expect(mockRes.cookie).toBeCalledWith("gameId", game.code, {
      sameSite: "strict",
    })
    expect(mockRes.cookie).toBeCalledWith(
      "privateId",
      expect.stringMatching(/[a-f\d]+-0/),
      {
        sameSite: "strict",
      }
    )
    expect(mockRes.cookie).toBeCalledWith("publicId", 0, {
      sameSite: "strict",
    })
  })

  it("fails", () => {
    const mockReq = makeMockRequest()
    const { mockRes } = makeMockResponse()

    join(mockReq, mockRes)

    expect(mockRes.cookie).toBeCalledTimes(0)
    expect(mockRes.status).toBeCalledWith(400)
    expect(mockRes.render).toBeCalledWith("error", {
      layout: false,
      helpers: {
        details: expect.stringContaining(""),
      },
    })
  })
})

describe("apiJoin", () => {
  const makeMockRequest = (username?: string, code?: string) =>
    ({
      body: {
        username,
        code,
      },
    } as any as Request)

  it("succeeds", () => {
    const game = generateGame(testListener)
    const mockReq = makeMockRequest("myusername", game.code)
    const { mockRes } = makeMockResponse()

    apiJoin(mockReq, mockRes)

    expect(mockRes.json).toBeCalledWith({
      publicId: 0,
      privateId: expect.stringMatching(/[a-f\d]+-0/),
      gameId: game.code,
    })
    expect(mockRes.cookie).toBeCalledWith("gameId", game.code, {
      sameSite: "strict",
    })
    expect(mockRes.cookie).toBeCalledWith(
      "privateId",
      expect.stringMatching(/[a-f\d]+-0/),
      {
        sameSite: "strict",
      }
    )
    expect(mockRes.cookie).toBeCalledWith("publicId", 0, {
      sameSite: "strict",
    })
    expect(mockRes.end).toBeCalled()
  })

  it("fails", () => {
    const mockReq = makeMockRequest()
    const { mockRes } = makeMockResponse()

    apiJoin(mockReq, mockRes)

    expect(mockRes.cookie).toBeCalledTimes(0)
    expect(mockRes.status).toBeCalledWith(400)
    expect(mockRes.json).toBeCalledWith(expect.stringContaining(""))
    expect(mockRes.end).toBeCalled()
  })
})
