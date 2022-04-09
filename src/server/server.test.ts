import { NextFunction, Request } from "express"
import { jest } from "@jest/globals"
import { gamePage } from "./server"
import * as logging from "./logging"
import { generateGameCode } from "./game"

logging.setupJestLogging()

test("gamePage invalid code format", async () => {
  const badlyFormatedCode = "wrong game code format"
  const mockRequest = {
    params: {
      code: badlyFormatedCode,
    },
  } as any as Request

  const render = jest.fn()
  const mockResponse = {
    status: jest.fn(),
    render,
  } as any

  const mockNext = jest.fn() as any as NextFunction

  gamePage("poop", mockRequest, mockResponse, mockNext)
  expect(mockNext).toBeCalledTimes(0)
  expect(mockResponse.status).toBeCalledWith(400)
  expect(render).toBeCalledWith("error", {
    layout: false,
    helpers: {
      details: `game code '${badlyFormatedCode}' is wrong, should be 4 words, for example: 'cat-dog-fish-spoon'`,
    },
  })
})

test("gamePage success", async () => {
  const mockRequest = {
    params: {
      code: generateGameCode(1),
    },
  } as any as Request

  const sendFile = jest.fn()
  const mockResponse = {
    status: jest.fn(),
    sendFile,
  } as any

  const mockNext = jest.fn() as any as NextFunction

  gamePage("poop/", mockRequest, mockResponse, mockNext)
  expect(mockNext).toBeCalledTimes(1)
  expect(mockResponse.status).toBeCalledWith(200)
  expect(sendFile).toBeCalledWith("poop/archived.html")
})
