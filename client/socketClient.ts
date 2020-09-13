import io from 'socket.io-client';

import * as SocketEvents from '../shared/socketEvents.js'
export * from '../shared/socketEvents.js'

export function setup(
    gameId: string,
    privateId: string,
    initialization: (msg: SocketEvents.ServerInitializationMsg) => void,
    badSnipe: (msg: SocketEvents.ServerBadSnipeMsg) => void,
    newUser: (msg: SocketEvents.NewUserMsg) => void,
    removeUser: (msg: SocketEvents.RemoveUserMsg) => void,
    makeTargets: (msg: SocketEvents.ServerMakeTargetsMsg) => void,
    undoMakeTargets: (msg: SocketEvents.ServerUndoMakeTargetsMsg) => void,
    start: (msg: SocketEvents.ServerStartMsg) => void,
    finished: (msg: SocketEvents.ServerFinishedMsg) => void,
    timeLeft: (msg: SocketEvents.ServerTimeLeftMsg) => void,
    chatMessage: (msg: SocketEvents.ServerChatMessage) => void,
    // this only needs to be supplied when not in a browser
    // otherwise window.location is used
    hostname = ''
): SocketIOClient.Socket {
    let socket = io(
        // leading slash is needed so IO nows we're giving it a path
        // otherwise it uses it as a domain
        `${hostname}/game/${gameId}`,
        {
            query: {
                "privateId": privateId,
            },
            // todo: review - done to avoid the default size limit
            // of payloads when polling because large files will exceed this
            // see maxHttpBufferSize at https://socket.io/docs/server-api/#new-Server-httpServer-options
            transports: ['websocket']
        }
    );

    socket.on('initialization', initialization);
    socket.on('New user', newUser);
    socket.on('Remove user', removeUser);
    socket.on('make targets', makeTargets);
    // targets made
    socket.on('undo make targets', undoMakeTargets);
    socket.on('start', start);
    // in game events
    socket.on('chat message', chatMessage);
    socket.on('bad snipe', badSnipe);
    socket.on('timeLeft', timeLeft);
    socket.on('game finished', finished);
    socket.on('error', (err: any) => console.log(err));
    socket.on('disconnect', (reason: any) => console.log(reason));
    socket.on('disconnecting', (reason: any) => console.log(reason));

    return socket;
}

export function chatMessage(socket: SocketIOClient.Socket, message: SocketEvents.ClientChatMessage) {
    socket.emit('chat message', message);
}

export function badSnipe(socket: SocketIOClient.Socket, msg: SocketEvents.ClientBadSnipe) {
    socket.emit('bad snipe', msg);
}

export function makeTargets(socket: SocketIOClient.Socket, msg: SocketEvents.ClientMakeTargets) {
    socket.emit('make targets', msg);
}

export function undoMakeTargets(socket: SocketIOClient.Socket) {
    socket.emit('undo make targets');
}

export function startGame(socket: SocketIOClient.Socket) {
    socket.emit('start game');
}

export function positionUpdate(socket: SocketIOClient.Socket, position: SocketEvents.ClientPositionUpdate) {
    socket.emit('positionUpdate', position);
}

export function stopGame(socket: SocketIOClient.Socket) {
    socket.emit('stop game');
}

export function removeUser(socket: SocketIOClient.Socket, publicId: number) {
    let msg: SocketEvents.ClientRemoveUser = { publicId: publicId }
    socket.emit('remove user', msg);
}