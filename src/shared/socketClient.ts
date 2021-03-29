import io from 'socket.io-client';

import * as SocketEvents from './socketEvents'
export * from './socketEvents'

export function setup(
    gameId: string,
    privateId: string,
    initialization: (msg: SocketEvents.ServerInitializationMsg) => void,
    badSnipe: (msg: SocketEvents.ServerBadSnipeMsg) => void,
    newUser: (msg: SocketEvents.NewUserMsg) => void,
    removeUser: (msg: SocketEvents.RemoveUserMsg) => void,
    updateSettings: (msg: SocketEvents.ServerUpdateSettingsMsg) => void,
    start: (msg: SocketEvents.ServerStartMsg) => void,
    finished: (msg: SocketEvents.ServerFinishedMsg) => void,
    timeLeft: (msg: SocketEvents.ServerTimeLeftMsg) => void,
    chatMessage: (msg: SocketEvents.ServerChatMessage) => void,
    resizeDone: (msg: SocketEvents.ServerResizeDone) => void,
    // this only needs to be supplied when not in a browser
    // otherwise window.location is used
    hostname = '',
    disconnect= (reason: any) => console.log(reason),
    error= (reason: any) => console.log(reason),
    disconnecting= (reason: any) => console.log(reason),
    connectError= (reason: any) => console.log(reason),
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
            transports: ['websocket'],
            // needed for local dev with self-signed cert
            rejectUnauthorized: false
        }
    );

    socket.on('initialization', initialization);
    socket.on('New user', newUser);
    socket.on('Remove user', removeUser);
    socket.on('update settings', updateSettings);
    socket.on('start', start);
    socket.on('chat message', chatMessage);
    socket.on('bad snipe', badSnipe);
    socket.on('timeLeft', timeLeft);
    socket.on('game finished', finished);
    socket.on('error', error);
    socket.on('connect_error', connectError);
    socket.on('disconnect', disconnect);
    socket.on('disconnecting', disconnecting);
    socket.on('resize done', resizeDone);
    return socket;
}

export function chatMessage(socket: SocketIOClient.Socket, message: SocketEvents.ClientChatMessage) {
    socket.emit('chat message', message);
}

export function badSnipe(socket: SocketIOClient.Socket, msg: SocketEvents.ClientBadSnipe) {
    socket.emit('bad snipe', msg);
}

export function updateSettings(socket: SocketIOClient.Socket, msg: SocketEvents.ClientUpdateSettings) {
    socket.emit('update settings', msg);
}

export function startGame(socket: SocketIOClient.Socket, msg: SocketEvents.ClientUpdateSettings) {
    socket.emit('start game', msg);
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