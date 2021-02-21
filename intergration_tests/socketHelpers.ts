import * as socketClient from '../src/shared/socketClient';
import * as https from 'https';
import fetch from 'node-fetch';

//todo: have this buffer events it recieves
export async function makeSocket(domain: string, gameId: string, privateId: string) {

    return new Promise<SocketIOClient.Socket>((resolve, reject) => {

        let socket = socketClient.setup(
            gameId,
            privateId,
            () => { resolve(socket) },
            () => { },
            () => { },
            () => { },
            () => { },
            () => { },
            () => { },
            () => { },
            (_) => { },
            () => { },
            domain
        );

        //assume 5 seconds is enough to get an init message from server
        setTimeout(reject, 2000)

    });
}

export async function makeGame(domain: string, username: string){
    const agent = new https.Agent({
        rejectUnauthorized: false
    })
    let details = await (await fetch(`${domain}/make?username=${username}&format=json`, { agent })).json();
    return [await makeSocket(domain, details.gameId, details.privateId), details.gameId]
}

export async function joinGame(domain: string, gameId:string, username: string){
    const agent = new https.Agent({
        rejectUnauthorized: false
    })
    let details = await (await fetch(`${domain}/join?code=${gameId}&username=${username}&format=json`, { agent })).json();
    return await makeSocket(domain, gameId, details.privateId)
}