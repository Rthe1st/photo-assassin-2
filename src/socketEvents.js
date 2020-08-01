import { finished } from "stream";

let socket;

function setup(
    gameId,
    privateId,
    initialization,
    badSnipe,
    newUser,
    removeUser,
    makeTargets,
    undoMakeTargets,
    start,
    finished,
    timeLeft,
    chatMessage
){
    socket = io(
        // leading slash is needed so IO nows we're giving it a path
        // otherwise it uses it as a domain
        `/${gameId}`,
        {
            query: {
                "privateId": privateId,
            }
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
}

function chatMessage(message){
    socket.emit('chat message', message);
}

function badSnipe(snipeNumber, snipePlayer){
    socket.emit('bad snipe', {snipeNumber: snipeNumber, snipePlayer: snipePlayer});
}

function makeTargets(gameLength, countDown){
    socket.emit('make targets', { gameLength: gameLength, countDown: countDown });
}

function undoMakeTargets(){
    socket.emit('undo make targets');
}

function startGame(){
    socket.emit('start game');
}

function positionUpdate(position){
    socket.emit('positionUpdate', position);
}

function stopGame(){
    socket.emit('stop game');
}

function removeUser(publicId){
    socket.emit('remove user', { publicId: publicId });
}

export { setup, makeTargets, badSnipe, chatMessage, undoMakeTargets, startGame, stopGame, removeUser, positionUpdate }