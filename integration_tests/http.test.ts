// these tests are only concerned with testing
// HTTP calls, not socket behavior
// except where socket interaction is needed to setup test state

import fetch, { Headers, RequestInit } from "node-fetch"
import * as https from "https"
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

test("http redirects to https", async () => {
  const response = await fetch(`http://localhost/a_url`, { redirect: "manual" })
  expect(response.status).toBe(302)
  expect(response.text()).resolves.toContain("https://localhost/a_url")
})

// test /

test("GET /", async () => {
  const agent = new https.Agent({
    rejectUnauthorized: false,
  })
  const response = await fetch(`${domain}/`, { agent })
  expect(response.status).toBe(200)
  expect(response.text()).resolves.toContain("<!-- lobby page -->")
  expect(response.headers.raw()).not.toHaveProperty("set-cookie")
})

test("GET / for error", async () => {
  const agent = new https.Agent({
    rejectUnauthorized: false,
  })
  const response = await fetch(`${domain}/?code=a-fake-game-code`, { agent })
  expect(response.status).toBe(404)
  expect(response.text()).resolves.toContain(
    "No game exists with the code &#x27;a-fake-game-code&#x27;"
  )
  expect(response.headers.raw()).not.toHaveProperty("set-cookie")
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

test("POST /api/make JSON", async () => {
  const response = await httpHelpers.post(
    `${domain}/api/make`,
    "username=player"
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

test("POST /make error", async () => {
  const response = await httpHelpers.post(`${domain}/api/make`, "")

  expect(response.status).toBe(400)
  expect(response.headers.raw()).not.toHaveProperty("set-cookie")
  expect(response.text()).resolves.toEqual(
    "\"You cannot use '' as a username, it is mandatory and must be less then 50 characters long.\""
  )
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
  expect(response.text()).resolves.toContain(
    "Internal server error - dev handler"
  )
})

// test /join

test("POST /join valid game", async () => {
  const gameDetails: any = await (
    await httpHelpers.post(`${domain}/api/make`, "username=player1")
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
    await httpHelpers.post(`${domain}/api/make`, "username=player1")
  ).json()

  const requestOptions: RequestInit = { redirect: "manual" }
  const response = await httpHelpers.post(
    `${domain}/api/join`,
    `username=player2&code=${gameDetails.gameId}`,
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

test("POST /join error", async () => {
  const response = await httpHelpers.post(`${domain}/join`, `username=player2`)
  expect(response.status).toBe(400)

  expect(response.text()).resolves.toContain(
    "Expected string, but was undefined"
  )
})
