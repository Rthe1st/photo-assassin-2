import { Request } from "express"
import { jest } from "@jest/globals"
import { gamePage, root } from "./server"
import * as logging from "./logging"
import { Game, generateGameCode, states } from "./game"

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
