import io from 'socket.io-client';
import * as serverGame from '../server/game'
import * as serverSocketHandler from '../server/socketHandler'

export function setup(
    gameId: string,
    privateId: string,
    initialization: (msg: {gameState: serverGame.ClientGame, chatHistory: any[]}) => void,
    badSnipe: (msg: {gameState: serverGame.ClientGame, snipePlayer: number, undoneSnipes: number[]}) => void,
    newUser: (msg: {publicId: number, gameState: serverGame.ClientGame}) => void,
    removeUser: (msg: {publicId: number, gameState: serverGame.ClientGame}) => void,
    makeTargets: (msg: {gameState:serverGame.ClientGame}) => void,
    undoMakeTargets: (msg: {publicId: number, gameState: serverGame.ClientGame}) => void,
    start: (msg: {gameState: serverGame.ClientGame}) => void,
    finished: (msg: {nextCode: string, winner: string}) => void,
    timeLeft: (msg: {gameState: serverGame.ClientGame}) => void,
    chatMessage: (msg: {message: serverSocketHandler.OutgoingMsg}) => void,
    // this only needs to be supplied when not in a browser
    // otherwise window.location is used
    hostname = ''
): SocketIOClient.Socket{
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

interface Message {
    text: string,
    image: File | Buffer,
    position: serverGame.Position,
    isSnipe: boolean,
}

export function chatMessage(socket: SocketIOClient.Socket, message: Message){
    socket.emit('chat message', message);
}

export function badSnipe(socket: SocketIOClient.Socket, snipeNumber: number, snipePlayer: number){
    socket.emit('bad snipe', {snipeNumber: snipeNumber, snipePlayer: snipePlayer});
}

export function makeTargets(socket: SocketIOClient.Socket, gameLength: number, countDown: number, proposedTargetList: number[]){
    socket.emit('make targets', { gameLength: gameLength, countDown: countDown, proposedTargetList: proposedTargetList });
}

export function undoMakeTargets(socket: SocketIOClient.Socket){
    socket.emit('undo make targets');
}

export function startGame(socket: SocketIOClient.Socket){
    socket.emit('start game');
}

export function positionUpdate(socket: SocketIOClient.Socket, position: serverGame.Position){
    socket.emit('positionUpdate', position);
}

export function stopGame(socket: SocketIOClient.Socket){
    socket.emit('stop game');
}

export function removeUser(socket: SocketIOClient.Socket, publicId: number){
    socket.emit('remove user', { publicId: publicId });
}
