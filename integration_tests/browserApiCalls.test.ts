// these tests are only concerned with testing
// the browser client code for making HTTP calls
import * as httpHelpers from './httpHelpers';
import * as clientApi from '../src/shared/clientApi';

import { jest } from '@jest/globals'
// needed for messy socket tests that don't clean themselves up well
jest.setTimeout(8000);

let domain = "https://localhost:3000";

test('clientApi.gameJson', async () => {

    let gameDetails = await (await httpHelpers.post(`${domain}/make`, "username=player1&format=json")).json();

    const gameJson = await clientApi.gameJson(gameDetails.gameId, domain);
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
    });
});
