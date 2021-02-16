import fetch from 'node-fetch';
import * as https from 'https';
import * as http from 'http'

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

test('GET /', async () => {
    const agent = new https.Agent({
        rejectUnauthorized: false
    })
    const response = await fetch(`${domain}/`, {agent});
    expect(response.status).toBe(200)
});

// todo: a test that triggers an error to check out default error logger works
// (but how would we confirm the error is logged to the console/)
