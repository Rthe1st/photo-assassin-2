// all runtime API calls made by browser code should be done via here
// so that we can test the calls in the integration tests

import * as SharedGame from './game';

import * as https from 'https';
import fetch from 'cross-fetch';

let defaultAgent: https.Agent;
let requestOptions: any;

// need for integrations tests because our cert is selfsigned
if (process.env.NODE_ENV == "test") {
    defaultAgent = new https.Agent({
        rejectUnauthorized: false
    });
    requestOptions = { agent: defaultAgent };
} else {
    requestOptions = {};
}

// todo: server should use same type when sending it
// like we do for sockets
export async function gameJson(gameId: string, domain: string): Promise<SharedGame.ClientGame>{
    let url = `${domain}/game/${gameId}?format=json`;
    const response = await fetch(url, requestOptions);
    return response.json();
}
