import io from 'socket.io-client';
export function setup(gameId, privateId, initialization, badSnipe, newUser, removeUser, makeTargets, undoMakeTargets, start, finished, timeLeft, chatMessage, 
// this only needs to be supplied when not in a browser
// otherwise window.location is used
hostname = '') {
    let socket = io(
    // leading slash is needed so IO nows we're giving it a path
    // otherwise it uses it as a domain
    `${hostname}/game/${gameId}`, {
        query: {
            "privateId": privateId,
        },
        // todo: review - done to avoid the default size limit
        // of payloads when polling because large files will exceed this
        // see maxHttpBufferSize at https://socket.io/docs/server-api/#new-Server-httpServer-options
        transports: ['websocket']
    });
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
    socket.on('error', (err) => console.log(err));
    socket.on('disconnect', (reason) => console.log(reason));
    socket.on('disconnecting', (reason) => console.log(reason));
    return socket;
}
export function chatMessage(socket, message) {
    socket.emit('chat message', message);
}
export function badSnipe(socket, msg) {
    socket.emit('bad snipe', msg);
}
export function makeTargets(socket, msg) {
    socket.emit('make targets', msg);
}
export function undoMakeTargets(socket) {
    socket.emit('undo make targets');
}
export function startGame(socket) {
    socket.emit('start game');
}
export function positionUpdate(socket, position) {
    socket.emit('positionUpdate', position);
}
export function stopGame(socket) {
    socket.emit('stop game');
}
export function removeUser(socket, publicId) {
    let msg = { publicId: publicId };
    socket.emit('remove user', msg);
}
