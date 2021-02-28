// these tests are only concerned with testing
// HTTP calls, not socket behavior
// except where socket interaction is needed to setup test state

import fetch, { Headers, RequestInit } from 'node-fetch';
import * as https from 'https';
import * as http from 'http'
import * as Logging from '../src/server/logging';

// todo: have logs per test
// and make optional (if it speeds things up)
Logging.setUpLogging('realGame');

import * as socketClient from '../src/shared/socketClient';
import * as Server from '../src/server/server';
import * as socketHelpers from './socketHelpers';
import * as httpHelpers from './httpHelpers';

import { jest } from '@jest/globals'
// needed for messy socket tests that don't clean themselves up well
jest.setTimeout(8000);

let s: http.Server;

beforeAll(() => {
    // todo: need a way to make server global across all tests
    // to avoid needing a new one per test file
    s = Server.createServer();
});

afterAll((done) => {
    //todo, why doesn't this tear down the server
    s.close(done);
});

let domain = "https://localhost:3000";

const agent = new https.Agent({
    rejectUnauthorized: false
})

function checkCookies(headers: Headers){
    expect(headers.raw()).toMatchObject({
        "set-cookie": expect.arrayContaining([
            expect.stringMatching(/gameId=[a-f\d]+-[a-f\d]+-\d/), expect.stringMatching(/privateId=[a-f\d]{512}-\d/),
            expect.stringMatching(/publicId=\d/)
        ])
    })
}

// test /

test('GET /', async () => {

    const response = await fetch(`${domain}/`, { agent });
    expect(response.status).toBe(200)
    expect(response.body.read().toString()).toContain("<!-- lobby page -->")
    expect(response.headers.raw()).not.toHaveProperty('set-cookie')
});

test('GET / for non-existent game', async () => {

    const response = await fetch(`${domain}/?code=madeupcode`, { agent });
    expect(response.status).toBe(404)
    expect(response.body.read().toString()).toContain("Can't join - game doesn't exist")
    expect(response.headers.raw()).not.toHaveProperty('set-cookie')
});

test('GET / for game that already started', async () => {
    let [player1, gameId] = await socketHelpers.makeGame(domain, 'player1')
    let player2 = await socketHelpers.joinGame(domain, gameId, 'player2')
    //todo: move into some default settings object
    let gameSettings = {
        gameLength: 60000,
        countDown: 0,
        proposedTargetList: [0, 1]
    };
    socketClient.startGame(player1, gameSettings);

    const response = await fetch(`${domain}/?code=${gameId}`, { agent });
    expect(response.status).toBe(403)
    expect(response.body.read().toString()).toContain("Can't join - game already in progress")
    expect(response.headers.raw()).not.toHaveProperty('set-cookie')
    player1.close();
    player2.close();
});

// test /make

test("POST /make", async () => {

    let requestOptions: RequestInit = { redirect: 'manual' }

    const response = await httpHelpers.post(`${domain}/make`, "username=player1", requestOptions);

    expect(response.status).toBe(302)
    expect(response.headers.raw()).toMatchObject({
        location: expect.arrayContaining([
            expect.stringMatching(new RegExp(`${domain}/game/[a-f\\d]{4}-[a-f\\d]{4}-\\d+`))
        ]),
        "set-cookie": expect.arrayContaining([
            expect.stringMatching(/gameId=[a-f\d]+-[a-f\d]+-\d/), expect.stringMatching(/privateId=[a-f\d]{512}-\d/),
            expect.stringMatching(/publicId=\d/)
        ])
    })
});

test("POST /make JSON", async () => {
    const response = await httpHelpers.post(`${domain}/make`, "username=player1&format=json");
    expect(response.status).toBe(200)
    // for api requests we should really accept not set cookies
    // and auth using the private ID (/an apikey)
    // expect(response.headers.raw()).not.toHaveProperty('set-cookie')

    let json = await response.json();

    // todo: workout how to only check publicId is positive int
    expect(json).toEqual({
        "publicId": 0,
        "privateId": expect.stringMatching(/[a-f\d]{512}-\d/),
        "gameId": expect.stringMatching(/[a-f\d]+-[a-f\d]+-\d/),
    })

});

test("POST /make no username", async () => {
    const response = await httpHelpers.post(`${domain}/make`, "");

    expect(response.status).toBe(400)
    expect(response.headers.raw()).not.toHaveProperty('set-cookie')
    expect(response.body.read().toString()).toContain("No username supplied")
});

// test error logging

// todo: is it possible to suppress the console.error() this produces
test("dev error handler", async () => {

    console.error = jest.fn()
    console.log = jest.fn()
    
    // todo: we should add a mock handle to an normal endpoint (/make)
    // that throws, instead of using this fake endpoint
    const response = await fetch(`${domain}/deliberate-error`, {agent});

    expect(response.status).toBe(500)
    expect(response.body.read().toString()).toContain("Internal server error - dev handler")
    expect(console.error).toHaveBeenCalled();
});

// test /join

test("POST /join valid game", async () => {

    let gameDetails = await (await httpHelpers.post(`${domain}/make`, "username=player1&format=json")).json();

    let requestOptions: RequestInit = { redirect: 'manual' }
    const response = await httpHelpers.post(`${domain}/join`, `username=player2&code=${gameDetails.gameId}`, requestOptions);
    expect(response.status).toBe(302)
    checkCookies(response.headers);

    expect(response.headers.raw()).toMatchObject({
        location: expect.arrayContaining([
            expect.stringMatching(new RegExp(`${domain}/game/[a-f\\d]{4}-[a-f\\d]{4}-\\d+`))
        ]),
    })
});

test("POST /join json", async () => {

    let gameDetails = await (await httpHelpers.post(`${domain}/make`, "username=player1&format=json")).json();

    let requestOptions: RequestInit = { redirect: 'manual' }
    const response = await httpHelpers.post(`${domain}/join`, `username=player2&code=${gameDetails.gameId}&format=json`, requestOptions);
    expect(response.status).toBe(200)
    checkCookies(response.headers);

    let json = await response.json();

    // todo: workout how to only check publicId is positive int
    expect(json).toEqual({
        "publicId": 1,
        "privateId": expect.stringMatching(/[a-f\d]{512}-\d/),
        "gameId": expect.stringMatching(/[a-f\d]+-[a-f\d]+-\d/),
    })
});

test("POST /join no code", async () => {

    const response = await httpHelpers.post(`${domain}/join`, `username=player2`);
    expect(response.status).toBe(403);

    expect(response.body.read().toString()).toContain("No game code supplied");
});

test("POST /join no username", async () => {
    let gameDetails = await (await httpHelpers.post(`${domain}/make`, "username=player1&format=json")).json();

    const response = await httpHelpers.post(`${domain}/join`, `code=${gameDetails.gameId}`);
    expect(response.status).toBe(403);
    expect(response.body.read().toString()).toContain("No username supplied");
});

test("POST /join invalid code", async () => {
    const response = await httpHelpers.post(`${domain}/join`, `username=player2&code=123`);
    expect(response.status).toBe(404);
    expect(response.body.read().toString()).toContain('Can\'t join - game doesn\'t exist');
});

test('POST /join for game that already started', async () => {
    let [player1, gameId] = await socketHelpers.makeGame(domain, 'player1')
    let player2 = await socketHelpers.joinGame(domain, gameId, 'player2')
    //todo: move into some default settings object
    let gameSettings = {
        gameLength: 60000,
        countDown: 0,
        proposedTargetList: [0, 1]
    };
    socketClient.startGame(player1, gameSettings);

    const response = await httpHelpers.post(`${domain}/join`, `username=player3&code=${gameId}`);

    expect(response.status).toBe(403)
    expect(response.body.read().toString()).toContain("Can't join - game already in progress");
    player1.close();
    player2.close();
});

// test /archived

test('GET /archived', async () => {

    const response = await fetch(`${domain}/archived`, { agent });
    expect(response.status).toBe(200)
    expect(response.body.read().toString()).toContain("<!-- archived page -->")
});
