import io from 'socket.io-client';
import * as SharedGame from '../shared/game'

export interface InitializationMsg {
    gameState: SharedGame.ClientGame,
    chatHistory: any[]
}

export interface NewUserMsg {
    publicId: number, gameState: SharedGame.ClientGame
}

export interface RemoveUserMsg {
    publicId: number, gameState: SharedGame.ClientGame
}

export interface ServerUndoMakeTargetsMsg { publicId: number, gameState: SharedGame.ClientGame }

export interface ServerMakeTargetsMsg { gameState: SharedGame.ClientGame }

export interface ServerBadSnipeMsg { gameState: SharedGame.ClientGame, snipePlayer: number, undoneSnipes: number[] }

export interface ServerFinishedMsg { nextCode: string, winner: string }

export interface ServerTimeLeftMsg { gameState: SharedGame.ClientGame }

export interface ServerStartMsg { gameState: SharedGame.ClientGame }

export interface ServerChatMessage {
    gameState: SharedGame.ClientGame,
    text: string,
    image: ArrayBuffer,
    position: SharedGame.Position,
    isSnipe: boolean,
    botMessage: string,
    publicId: number,
    snipeNumber: number,
    snipeCount: number,
    snipePlayer: number,
}

export function setup(
    gameId: string,
    privateId: string,
    initialization: (msg: InitializationMsg) => void,
    badSnipe: (msg: ServerBadSnipeMsg) => void,
    newUser: (msg: NewUserMsg) => void,
    removeUser: (msg: RemoveUserMsg) => void,
    makeTargets: (msg: ServerMakeTargetsMsg) => void,
    undoMakeTargets: (msg: ServerUndoMakeTargetsMsg) => void,
    start: (msg: ServerStartMsg) => void,
    finished: (msg: ServerFinishedMsg) => void,
    timeLeft: (msg: ServerTimeLeftMsg) => void,
    chatMessage: (msg: ServerChatMessage) => void,
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

export interface ClientChatMessage {
    text: string,
    image?: File | ArrayBuffer,
    position?: SharedGame.Position,
    isSnipe?: boolean
}

export interface ClientBadSnipe {
    snipeNumber: number,
    sniperPlayer: number
}

export interface ClientMakeTargets {
    gameLength: number,
    countDown: number,
    proposedTargetList: number[]
}

export interface ClientRemoveUser {
    publicId: number
}

export function chatMessage(socket: SocketIOClient.Socket, message: ClientChatMessage) {
    socket.emit('chat message', message);
}

export function badSnipe(socket: SocketIOClient.Socket, msg: ClientBadSnipe) {
    socket.emit('bad snipe', msg);
}

export function makeTargets(socket: SocketIOClient.Socket, msg: ClientMakeTargets) {
    socket.emit('make targets', msg);
}

export function undoMakeTargets(socket: SocketIOClient.Socket) {
    socket.emit('undo make targets');
}

export function startGame(socket: SocketIOClient.Socket) {
    socket.emit('start game');
}

export type ClientPositionUpdate = SharedGame.Position

export function positionUpdate(socket: SocketIOClient.Socket, position: ClientPositionUpdate) {
    socket.emit('positionUpdate', position);
}

export function stopGame(socket: SocketIOClient.Socket) {
    socket.emit('stop game');
}

export function removeUser(socket: SocketIOClient.Socket, publicId: number) {
    let msg: ClientRemoveUser = { publicId: publicId }
    socket.emit('remove user', msg);
}
