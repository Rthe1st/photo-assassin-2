// these tests are only concerned with testing
// HTTP calls, not socket behavior
// except where socket interaction is needed to setup test state

import fetch, { Headers, RequestInit } from "node-fetch"
import * as https from "https"

import * as socketBots from "../src/bots/socketBots"
import * as socketClient from "../src/shared/socketClient"
import * as socketHelpers from "./socketHelpers"
import * as httpHelpers from "./httpHelpers"
import { domain, gameCodeFormat } from "./shared_definitions"

function checkCookies(headers: Headers) {
  expect(headers.raw()).toMatchObject({
    "set-cookie": expect.arrayContaining([
      expect.stringMatching(new RegExp(`gameId=${gameCodeFormat}`)),
      expect.stringMatching(/privateId=[a-f\d]{512}-\d/),
      expect.stringMatching(/publicId=\d/),
    ]),
  })
}

// test /

test("GET /", async () => {
  const agent = new https.Agent({
    rejectUnauthorized: false,
  })
  const response = await fetch(`${domain}/`, { agent })
  expect(response.status).toBe(200)
  expect(response.body!.read().toString()).toContain("<!-- lobby page -->")
  expect(response.headers.raw()).not.toHaveProperty("set-cookie")
})

test("GET / for non-existent game", async () => {
  const agent = new https.Agent({
    rejectUnauthorized: false,
  })
  const response = await fetch(`${domain}/?code=madeupcode`, { agent })
  expect(response.status).toBe(404)
  expect(response.body!.read().toString()).toContain(
    "Can't join - game doesn't exist"
  )
  expect(response.headers.raw()).not.toHaveProperty("set-cookie")
})

test("GET / for game that already started", async () => {
  const agent = new https.Agent({
    rejectUnauthorized: false,
  })
  const [player1, gameId] = await socketHelpers.makeGame(domain, "player1")
  const player2 = await socketHelpers.joinGame(domain, gameId, "player2")
  //todo: move into some default settings object
  const gameSettings = {
    gameLength: 60000,
    countDown: 0,
    proposedTargetList: [0, 1],
  }
  socketClient.startGame(player1, gameSettings)

  const response = await fetch(`${domain}/?code=${gameId}`, { agent })
  expect(response.status).toBe(403)
  expect(response.body!.read().toString()).toContain(
    "Can't join - game already in progress"
  )
  expect(response.headers.raw()).not.toHaveProperty("set-cookie")

  await socketHelpers.closeSockets([player1, player2])
})

// test /make

test("POST /make", async () => {
  const requestOptions: RequestInit = { redirect: "manual" }

  const response = await httpHelpers.post(
    `${domain}/make`,
    "username=player1",
    requestOptions
  )

  expect(response.status).toBe(302)
  expect(response.headers.raw()).toMatchObject({
    location: expect.arrayContaining([
      expect.stringMatching(new RegExp(`/game/${gameCodeFormat}`)),
    ]),
    "set-cookie": expect.arrayContaining([
      expect.stringMatching(RegExp(`gameId=${gameCodeFormat}`)),
      expect.stringMatching(/privateId=[a-f\d]{512}-\d/),
      expect.stringMatching(/publicId=\d/),
    ]),
  })
})

test("POST /make JSON", async () => {
  const response = await httpHelpers.post(
    `${domain}/make`,
    "username=player1&format=json"
  )
  expect(response.status).toBe(200)
  // for api requests we should really accept not set cookies
  // and auth using the private ID (/an apikey)
  // expect(response.headers.raw()).not.toHaveProperty('set-cookie')

  const json = await response.json()

  // todo: workout how to only check publicId is positive int
  expect(json).toEqual({
    publicId: 0,
    privateId: expect.stringMatching(/[a-f\d]{512}-\d/),
    gameId: expect.stringMatching(new RegExp(`${gameCodeFormat}`)),
  })
})

test("POST /make no username", async () => {
  const response = await httpHelpers.post(`${domain}/make`, "")

  expect(response.status).toBe(400)
  expect(response.headers.raw()).not.toHaveProperty("set-cookie")
  expect(response.body!.read().toString()).toContain("No username supplied")
})

// test error logging

// todo: is it possible to suppress the console.error() this produces
test("dev error handler", async () => {
  // todo: we should add a mock handle to an normal endpoint (/make)
  // that throws, instead of using this fake endpoint
  const agent = new https.Agent({
    rejectUnauthorized: false,
  })
  const response = await fetch(`${domain}/deliberate-error`, { agent })

  expect(response.status).toBe(500)
  expect(response.body!.read().toString()).toContain(
    "Internal server error - dev handler"
  )
})

// test /join

test("POST /join valid game", async () => {
  const gameDetails: any = await (
    await httpHelpers.post(`${domain}/make`, "username=player1&format=json")
  ).json()

  const requestOptions: RequestInit = { redirect: "manual" }
  const response = await httpHelpers.post(
    `${domain}/join`,
    `username=player2&code=${gameDetails.gameId}`,
    requestOptions
  )
  expect(response.status).toBe(302)
  checkCookies(response.headers)

  expect(response.headers.raw()).toMatchObject({
    location: expect.arrayContaining([
      expect.stringMatching(new RegExp(`/game/${gameCodeFormat}`)),
    ]),
  })
})

test("POST /join json", async () => {
  const gameDetails: any = await (
    await httpHelpers.post(`${domain}/make`, "username=player1&format=json")
  ).json()

  const requestOptions: RequestInit = { redirect: "manual" }
  const response = await httpHelpers.post(
    `${domain}/join`,
    `username=player2&code=${gameDetails.gameId}&format=json`,
    requestOptions
  )
  expect(response.status).toBe(200)
  checkCookies(response.headers)

  const json = await response.json()

  // todo: workout how to only check publicId is positive int
  expect(json).toEqual({
    publicId: 1,
    privateId: expect.stringMatching(/[a-f\d]{512}-\d/),
    gameId: expect.stringMatching(new RegExp(`${gameCodeFormat}`)),
  })
})

test("POST /join no code", async () => {
  const response = await httpHelpers.post(`${domain}/join`, `username=player2`)
  expect(response.status).toBe(403)

  expect(response.body!.read().toString()).toContain("No game code supplied")
})

test("POST /join no username", async () => {
  const gameDetails: any = await (
    await httpHelpers.post(`${domain}/make`, "username=player1&format=json")
  ).json()

  const response = await httpHelpers.post(
    `${domain}/join`,
    `code=${gameDetails.gameId}`
  )
  expect(response.status).toBe(403)
  expect(response.body!.read().toString()).toContain("No username supplied")
})

test("POST /join invalid code", async () => {
  const response = await httpHelpers.post(
    `${domain}/join`,
    `username=player2&code=123`
  )
  expect(response.status).toBe(404)
  expect(response.body!.read().toString()).toContain(
    "Can't join - game doesn't exist"
  )
})

test("POST /join for game that already started", async () => {
  const details = await socketBots.makeGame("player1", domain)
  const { socket: player1, msg: _initMessage } = await socketHelpers.makeSocket(
    domain,
    details.gameId,
    details.privateId
  )
  const player2 = await socketHelpers.joinGame(
    domain,
    details.gameId,
    "player2"
  )
  //todo: move into some default settings object
  const gameSettings = {
    gameLength: 60000,
    countDown: 0,
    proposedTargetList: [0, 1],
  }
  socketClient.startGame(player1, gameSettings)
  const response = await httpHelpers.post(
    `${domain}/join`,
    `username=player3&code=${details.gameId}`
  )

  expect(response.status).toBe(403)
  expect(response.body!.read().toString()).toContain(
    "Can't join - game already in progress"
  )

  await socketHelpers.closeSockets([player1, player2])
})

// test /archived

test("GET /archived", async () => {
  const agent = new https.Agent({
    rejectUnauthorized: false,
  })
  const response = await fetch(`${domain}/archived`, { agent })
  expect(response.status).toBe(200)
  expect(response.body!.read().toString()).toContain("<!-- archived page -->")
})
