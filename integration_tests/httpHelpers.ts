import * as https from "https"
import fetch, { RequestInit } from "node-fetch"

const defaultAgent = new https.Agent({
  rejectUnauthorized: false,
})

export async function post(
  url: string,
  body: string,
  options: RequestInit = {},
  agent = defaultAgent
) {
  let requestOptions: RequestInit = {
    method: "POST",
    agent: agent,
    body: body,
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
  }

  requestOptions = { ...requestOptions, ...options }

  return fetch(url, requestOptions)
}
