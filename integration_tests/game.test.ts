import { jest } from '@jest/globals'
// needed for messy socket tests that don't clean themselves up well
jest.setTimeout(10000);
import * as socketHelpers from './socketHelpers'

import * as socketBots from '../src/server/socketBots';

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

    let msg = await socketHelpers.startGame(player1, gameSettings);
    let expectedGameState = {
        "chosenSettings": {
            "countDown": 0,
            "gameLength": 60000,
            "proposedTargetList": [0,1,],
        },
        "latestSnipeIndexes": [],
        "snipeInfos": [],
        "state": "IN PLAY",
        "subState": "PLAYING",
        "targets": {
        "0": [1,],
        "1": [0,],
        },
        "targetsGot": {"0": [],"1": [],},
        "userList": {
            "0": {
                "username": "hostplayer",
            },
            "1": {
                "username": "passiveplayer",
            },
        },
    };
    expect(msg).toMatchObject({gameState: expectedGameState});

    let finishedMsg = await socketHelpers.stopGame(player1);
    expect(finishedMsg).toMatchObject({
        "nextCode": expect.stringMatching(/[a-f\d]+-[a-f\d]+-\d/),
        "winner": "game stopped",
    });

    player1.close();
    player2.close();
})
