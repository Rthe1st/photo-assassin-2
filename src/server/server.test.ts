import { Request } from "express"
import { jest } from "@jest/globals"
import { apiMake, gamePage, make, root } from "./server"
import * as logging from "./logging"
import { Game, generateGameCode, states } from "./game"
import { Listener } from "./socketInterface"

logging.setupJestLogging()

describe("gamepage", () => {
  const staticDir = "poop/"

  const makeMockResponse = () =>
    ({
      status: jest.fn(),
      render: jest.fn(),
      sendFile: jest.fn(),
      redirect: jest.fn(),
    } as any)

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
    const mockResponse = makeMockResponse()

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
    const mockResponse = makeMockResponse()

    gamePage(staticDir, mockRequest, mockResponse, () => undefined)
    expect(mockResponse.sendFile).toBeCalledWith(`${staticDir}archived.html`)
  })

  test("game exists but client is not in it", async () => {
    const mockRequest = makeMockRequest(generateGameCode(1), "myprivateid")
    const mockResponse = makeMockResponse()

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
    const mockResponse = makeMockResponse()

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

  const getMockResponse = () =>
    ({
      status: jest.fn(),
      render: jest.fn(),
      sendFile: jest.fn(),
    } as any)

  const getMockRequest = (code?: string) =>
    ({
      query: {
        code,
      },
    } as any as Request)

  test("failure with invalid game code format", async () => {
    const badlyFormatedGameCode = "not a valid game code"

    const mockRequest = getMockRequest(badlyFormatedGameCode)
    const mockResponse = getMockResponse()

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
    const mockResponse = getMockResponse()

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
    const mockResponse = getMockResponse()

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
    const mockResponse = getMockResponse()

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
    const mockResponse = getMockResponse()

    root("poop/", mockRequest, mockResponse, () => undefined)
    expect(mockResponse.sendFile).toBeCalledWith(`${staticDir}lobby.html`)
  })
})

describe("make", () => {
  function testListener(): Listener {
    return {
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

  const makeMockResponse = () => {
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
      expect.stringMatching(/[a-e\d]+-0/),
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
        expect.stringMatching(/[a-e\d]+-0/),
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
