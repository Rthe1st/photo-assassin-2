import { jest } from '@jest/globals'
// needed for messy socket tests that don't clean themselves up well
jest.setTimeout(10000);
import * as socketHelpers from './socketHelpers'

import * as socketBots from '../src/server/socketBots';
import * as socketClient from '../src/shared/socketClient';

let domain = "https://localhost:3000";

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
        proposedTargetList: [0, 1]
    };
    socketClient.startGame(player1, gameSettings);
    // todo: wait till start game is confirmed before stopping
    socketClient.stopGame(player1);
    // assume 5 seconds is long enough
    await new Promise(resolve => setTimeout(resolve, 5000));
    player1.close();
    player2.close();
})
