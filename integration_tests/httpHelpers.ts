import * as https from "https"
import fetch, { RequestInit } from "node-fetch"

export async function post(
  url: string,
  body: string,
  options: RequestInit = {},
  agent?: https.Agent
) {
  if (agent === undefined) {
    agent = new https.Agent({
      rejectUnauthorized: false,
    })
  }

  let requestOptions: RequestInit = {
    method: "POST",
    agent: agent,
    body: body,
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
  }

  requestOptions = { ...requestOptions, ...options }

  return fetch(url, requestOptions)
}
