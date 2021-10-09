import { ImageStore } from "./imageStore"
import * as game from "../shared/game"
import * as api from "../shared/clientApi"
import * as fs from "fs"
import fetch from "node-fetch"
import dotenv from "dotenv"

import { jest } from "@jest/globals"
// needed for messy socket tests that don't clean themselves up well
jest.setTimeout(8000)

// todo: create a test service account
// we don't consider mocking gcp as imageStore shouldn't have much logic
// to test, independent of the GCP connection
test("upload file and access it", async () => {
  // for gcp secrets
  //todo: make seperate test creds
  dotenv.config()
  const file = fs.readFileSync("./src/server/sample_snipe_image.jpeg")
  const imageStore = new ImageStore()
  const fileUrl = await imageStore.upload(file, "test/file/path")
  expect(fileUrl).toBe(
    "https://storage-photo-assassin.prangten.com/test/file/path"
  )

  const fileFromCloud = await fetch(fileUrl)
    .then((response) => {
      return response.blob()
    })
    .then((blob) => {
      // casting because fetch seems to have its own blob type
      // more reason to move to axios?
      return (blob as Blob).arrayBuffer()
    })
    .then((arrayBuffer: ArrayBuffer) => {
      return Buffer.from(arrayBuffer)
    })

  expect(fileFromCloud).toStrictEqual(file)
  // todo: delete the file from google cloud
  // so the next run doesn't accidentally pass
})

test("upload game state file and access it", async () => {
  dotenv.config()
  const imageStore = new ImageStore()
  // todo: using a real game here would also
  // let us check that the game serializes correctly
  // but I think that should be handled in a dedicated test
  const fakeGame = { fakeProperty: "fakeValue" } as any
  const code = "upload-game-state-file-and-access-it"
  const fileUrl = await imageStore.uploadGameState(
    fakeGame as game.ClientGame,
    code
  )
  expect(fileUrl).toBe(api.gameStateUrl(code))
  // todo: to make this a truer test, we should purge the cloudflare cache
  // or, also test against the direct value from google
  const fileFromCloud = await fetch(fileUrl).then((response) => {
    return response.json()
  })

  expect(fileFromCloud).toEqual(fakeGame)
  // todo: delete the file from google cloud
  // so the next run doesn't accidentally pass
})
