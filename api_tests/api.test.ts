import fetch from 'node-fetch';
import * as https from 'https';
import * as http from 'http'
import * as Logging from '../src/server/logging';

// todo: have logs per test
// and make optional (if it speeds things up)
Logging.setUpLogging('realGame');

import * as Server from '../src/server/server';

let s: http.Server;

beforeAll(() => {
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

test('GET /', async () => {

    const response = await fetch(`${domain}/`, { agent });
    expect(response.status).toBe(200)
    expect(response.body.read().toString()).toContain("<!-- lobby page -->")
    expect(response.headers.raw()).not.toHaveProperty('set-cookie')
});

test("GET /make", async () => {
    const response = await fetch(`${domain}/make?username=myusername`, { agent });

    expect(response.status).toBe(200)
    expect(response.body.read().toString()).toContain("<!-- lobby page -->")
});

test("GET /make JSON", async () => {
    const response = await fetch(`${domain}/make?username=myusername&format=json`, { agent });
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

// todo: a test that triggers an error to check out default error logger works
// (but how would we confirm the error is logged to the console/)
