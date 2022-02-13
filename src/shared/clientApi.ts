// all runtime API calls made by browser code should be done via here
// so that we can test the calls in the integration tests

import * as SharedGame from "./game"

import * as https from "https"
import fetch from "cross-fetch"

let defaultAgent: https.Agent
let requestOptions: any

// need for integrations tests because our cert is selfsigned
if (process.env.NODE_ENV == "test") {
  defaultAgent = new https.Agent({
    rejectUnauthorized: false,
  })
  requestOptions = { agent: defaultAgent }
} else {
  requestOptions = {}
}

export function gameStateUrl(code: string): string {
  return "/games/" + gameStatePath(code)
}

export function gameStatePath(code: string): string {
  return `${code}/state.json`
}

// todo: server should use same type when sending it
// like we do for sockets
export async function gameJson(code: string): Promise<SharedGame.ClientGame> {
  const url = gameStateUrl(code)
  requestOptions["Content-Type"] = "application/json"
  requestOptions["Access-Control-Request-Method"] = "GET"
  requestOptions["Access-Control-Request-Headers"] = "Content-Type"
  return fetch(url, requestOptions).then((response) => {
    if (!response.ok) {
      return Promise.reject(response)
    }
    return response.json()
  })
}
