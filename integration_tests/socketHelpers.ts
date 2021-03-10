import * as socketClient from '../src/shared/socketClient';
import * as httpHelpers from './httpHelpers'
import * as SocketEvents from '../src/shared/socketEvents';

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
            domain,
            () => {}
        );

        //assume 5 seconds is enough to get an init message from server
        setTimeout(reject, 2000)

    });
}

export function socketCall(emit_fn:any, resolve_fn:any): Promise<any> {
    return new Promise<any>((resolve, reject) => {
        resolve_fn(resolve)
        emit_fn()
        setTimeout(reject, 100);
    });
}

export function startGame(socket: SocketIOClient.Socket, msg: SocketEvents.ClientUpdateSettings): Promise<SocketEvents.ServerStartMsg> {
    let emit_fn = () => socketClient.startGame(socket, msg);
    let resolve_fn = (resolve: any) => socket.on('start', resolve);
    return socketCall(emit_fn, resolve_fn);
}

export function stopGame(socket: SocketIOClient.Socket): Promise<SocketEvents.ServerStartMsg> {
    let emit_fn = () => socketClient.stopGame(socket);
    let resolve_fn = (resolve: any) => socket.on('game finished', resolve);
    return socketCall(emit_fn, resolve_fn);
}



export async function makeGame(domain: string, username: string) {
    const details = await (await httpHelpers.post(`${domain}/make`, `username=${username}&format=json`)).json();
    return [await makeSocket(domain, details.gameId, details.privateId), details.gameId]
}

export async function joinGame(domain: string, gameId: string, username: string) {
    const details = await (await httpHelpers.post(`${domain}/join`, `code=${gameId}&username=${username}&format=json`)).json();
    return await makeSocket(domain, gameId, details.privateId)
}