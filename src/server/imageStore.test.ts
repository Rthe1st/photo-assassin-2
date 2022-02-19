import * as imageStore from "./imageStore"
import * as game from "../shared/game"
import * as api from "../shared/clientApi"
import * as fs from "fs"
import FakeTimers from "@sinonjs/fake-timers"

test("cleanUp", async () => {
  const gameDir = "./games/my-code"
  const gameFile = `${gameDir}/test`
  fs.mkdirSync(gameDir)
  fs.writeFileSync(gameFile, "")
  const clock = FakeTimers.install({ now: Date.now() })
  await imageStore.cleanUp()
  expect(fs.existsSync(gameDir)).toBe(true)
  clock.tick(1000 * 60 * 60 * 24 * 7 + 1)
  await imageStore.cleanUp()
  expect(fs.existsSync(gameDir)).toBe(false)
  clock.uninstall()
})

test("uploadLowResImage", async () => {
  const file = fs.readFileSync("./src/server/sample_snipe_image.jpeg")
  const gameCode = "my-game-code"
  const imageId = 0
  const fileUrl = await imageStore.uploadLowResImage(file, gameCode, imageId)
  const expectedDiskPath = `games/${gameCode}/low-res/${imageId}.webp`
  expect(fileUrl).toBe("/" + expectedDiskPath)
  expect(fileUrl).toBe(imageStore.getUploadImageLowResUrl(gameCode, imageId))

  const fromDisk = fs.readFileSync(expectedDiskPath)
  expect(fromDisk).toStrictEqual(file)
  fs.unlinkSync(expectedDiskPath)
})

test("uploadImage", async () => {
  const file = fs.readFileSync("./src/server/sample_snipe_image.jpeg")
  const gameCode = "my-game-code"
  const imageId = 0
  const fileUrl = await imageStore.uploadImage(file, gameCode, imageId)
  const expectedDiskPath = `games/${gameCode}/image/${imageId}.webp`
  expect(fileUrl).toBe("/" + expectedDiskPath)
  expect(fileUrl).toBe(imageStore.getUploadImageUrl(gameCode, imageId))

  const fromDisk = fs.readFileSync(expectedDiskPath)
  expect(fromDisk).toStrictEqual(file)
  fs.unlinkSync(expectedDiskPath)
})

test("uploadGameState", async () => {
  // todo: using a real game here would also
  // let us check that the game serializes correctly
  // but that should be handled in a dedicated test
  const fakeGame = { fakeProperty: "fakeValue" } as any
  const code = "upload-game-state-file-and-access-it"
  const fileUrl = await imageStore.uploadGameState(
    fakeGame as game.ClientGame,
    code
  )
  const expectedDiskPath =
    "games/upload-game-state-file-and-access-it/state.json"
  expect(fileUrl).toBe(api.gameStateUrl(code))
  expect(fileUrl).toBe(`/${expectedDiskPath}`)
  const fromDisk = fs.readFileSync(expectedDiskPath)
  expect(JSON.parse(fromDisk.toString())).toStrictEqual(fakeGame)
  fs.unlinkSync(expectedDiskPath)
})
