import { NextFunction, Request } from "express"
import { jest } from "@jest/globals"
import { gamePage } from "./server"
import * as logging from "./logging"
import { generateGameCode } from "./game"

logging.setupJestLogging()

test("gamePage invalid code type", async () => {
  const mockRequest = {
    params: {
      code: 123,
    },
  } as any as Request

  const send = jest.fn()
  const mockResponse = {
    status: jest.fn(),
    send,
  } as any

  const mockNext = jest.fn() as any as NextFunction

  gamePage("poop", mockRequest, mockResponse, mockNext)
  expect(mockNext).toBeCalledTimes(0)
  expect(mockResponse.status).toBeCalledWith(400)
  expect(send).toBeCalledWith({ code: "Expected string, but was number" })
})

test("gamePage invalid code format", async () => {
  const mockRequest = {
    params: {
      code: "wrong game code format",
    },
  } as any as Request

  const send = jest.fn()
  const mockResponse = {
    status: jest.fn(),
    send,
  } as any

  const mockNext = jest.fn() as any as NextFunction

  gamePage("poop", mockRequest, mockResponse, mockNext)
  expect(mockNext).toBeCalledTimes(0)
  expect(mockResponse.status).toBeCalledWith(400)
  expect(send).toBeCalledWith({
    code: "Failed constraint check for string: code does not match format /^[a-z]+-[a-z]+-[a-z]+-[a-z]+$/",
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
