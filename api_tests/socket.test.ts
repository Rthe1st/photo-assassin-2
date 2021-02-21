import * as http from 'http'
import { jest } from '@jest/globals'
// needed for messy socket tests that don't clean themselves up well
jest.setTimeout(10000);
import * as Logging from '../src/server/logging';
import * as socketHelpers from './socketHelpers'

// todo: have logs per test
// and make optional (if it speeds things up)
Logging.setUpLogging('realGame');

import * as socketBots from '../src/server/socketBots';
import * as Server from '../src/server/server';
import * as socketClient from '../src/shared/socketClient';

let s: http.Server;

beforeAll(() => {
    // new port is a hack to make it not clash with server
    // from api.test.ts
    // would be better to have global test server across all intergration tests
    // also, this screws up logging
    s = Server.createServer("30001");
});

afterAll((done) => {
    //todo, why doesn't this tear down the server
    s.close(done);
});

let domain = "https://localhost:30001";

// todo: make this way more promise/event callback friendly
test('whole game', async () => {
    let details = await socketBots.makeGame("hostplayer", domain);
    let player1 = await socketHelpers.makeSocket(domain, details.gameId, details.privateId)
    let gameId = details.gameId;
    details = await socketBots.joinGame("passiveplayer", gameId!, domain);
    let player2 = await socketHelpers.makeSocket(domain, details.gameId, details.privateId);

    let gameSettings = {
        gameLength: 60000,
        countDown: 0,
        proposedTargetList: [0,1]
    };
    socketClient.startGame(player1, gameSettings);
    // todo: wait till start game is confirmed before stopping
    socketClient.stopGame(player1);
    // assume 5 seconds is long enough
    await new Promise(resolve => setTimeout(resolve, 5000));
    player1.close();
    player2.close();
})
