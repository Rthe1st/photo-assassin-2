import * as https from 'https';
import fetch from 'node-fetch';

const defaultAgent = new https.Agent({
    rejectUnauthorized: false
})

export async function post(url: string, body:string, agent=defaultAgent){

    let requestOptions = {method: "POST", agent: agent, body: body, headers:{ 'Content-Type': 'application/x-www-form-urlencoded' }};

    return fetch(url, requestOptions);
}