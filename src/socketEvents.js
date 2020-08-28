import io from 'socket.io-client';

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
    chatMessage,
    // this only needs to be supplied when not in a browser
    // otherwise window.location is used
    hostname = ''
){
    let socket = io(
        // leading slash is needed so IO nows we're giving it a path
        // otherwise it uses it as a domain
        `${hostname}/game/${gameId}`,
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

    return socket;
}

function chatMessage(socket, message){
    socket.emit('chat message', message);
}

function badSnipe(socket, snipeNumber, snipePlayer){
    socket.emit('bad snipe', {snipeNumber: snipeNumber, snipePlayer: snipePlayer});
}

function makeTargets(socket, gameLength, countDown, proposedTargetList){
    socket.emit('make targets', { gameLength: gameLength, countDown: countDown, proposedTargetList: proposedTargetList });
}

function undoMakeTargets(socket){
    socket.emit('undo make targets');
}

function startGame(socket){
    socket.emit('start game');
}

function positionUpdate(socket, position){
    socket.emit('positionUpdate', position);
}

function stopGame(socket){
    socket.emit('stop game');
}

function removeUser(socket, publicId){
    socket.emit('remove user', { publicId: publicId });
}

export { setup, makeTargets, badSnipe, chatMessage, undoMakeTargets, startGame, stopGame, removeUser, positionUpdate }