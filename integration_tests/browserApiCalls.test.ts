// these tests are only concerned with testing
// the browser client code for making HTTP calls
import * as httpHelpers from "./httpHelpers"
import * as clientApi from "../src/shared/clientApi"
import { domain } from "./shared_definitions"

import { jest } from "@jest/globals"
// needed for messy socket tests that don't clean themselves up well
jest.setTimeout(8000)

test.skip("clientApi.gameJson", async () => {
  const gameDetails: any = await (
    await httpHelpers.post(`${domain}/api/make`, "username=player1")
  ).json()

  await httpHelpers.post(
    `${domain}/api/join`,
    `code={gameCode}&username=player2`
  )

  // todo: fix, we need to finish the game in order
  // to trigger an upload of the json

  const gameJson = await clientApi.gameJson(gameDetails.gameId)
  // we don't really care what's in here
  // other functions can test the game logic values are populated right
  expect(gameJson).toMatchObject({
    chosenSettings: expect.anything(),
    state: expect.anything(),
    userList: expect.anything(),
    targets: expect.anything(),
    targetsGot: expect.anything(),
    snipeInfos: expect.anything(),
    latestSnipeIndexes: expect.anything(),
  })
})
