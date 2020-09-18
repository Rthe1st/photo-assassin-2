import { logger } from './logging.js'
import * as Game from './game.js'
import * as socketEvents from '../shared/socketEvents.js'
import * as socketHandler from './socketHandler.js'

export function setup(
    games: Map<string, Game.Game>,
    io: SocketIO.Server
) {

  var game = Game.generateGame(games.size);
  var namespace = io.of(`/game/${game.code}`);
    // I don't like namespace getting registered on game after game is already made
    game.namespace = namespace;
    // register connection after setting game space to prevent race condition
    // where ioConnect relies on game.namespace
    namespace.on('connection', (socket) => socketConnect(
        socket,
        games,
        io
    ))
    games.set(game.code, game);
    return game;
}

function socketConnect(
    socket: SocketIO.Socket,
    games: Map<string,Game.Game>,
    io: SocketIO.Server
){
    var gameId = socket.nsp.name.substr('/game/'.length);

    let game = games.get(gameId)!;
  
    if (game == undefined) {
      logger.log("verbose", `invalid game ${gameId}`);
      return;
    }
    let privateId = socket.handshake.query.privateId;
  
    //todo: allow sockets to connect in "view only" mode if they're not players
    let publicId = game.idMapping.get(privateId)!
    if (publicId == undefined) {
      logger.log("verbose", `invalid privateId ${privateId}`);
      return;
    }
  
    logger.log("debug", "Socket connected", { publicId: publicId, gameCode: gameId });
  
    // todo: clean up wtf chathistory is
    for(let ch of game.chatHistory){
      if(ch.imageId != undefined){
        ch.resizeIsAvailable = game.lowResImages[ch.imageId] != undefined
      }
    }

    let initializationMsg: socketEvents.ServerInitializationMsg = { gameState: Game.gameStateForClient(game), chatHistory: game.chatHistory }
    socket.emit('initialization', initializationMsg);
  
    // todo: can we do a switch statement on socket event
    // and cast the event name to an enum, to check we cover all options?
  
    socket.on('make targets', (msg) => socketHandler.makeTargets(msg, game, socket));
  
    socket.on('undo make targets', (_) => socketHandler.undoMakeTargets(game, socket));
  
    socket.on('remove user', (msg) => socketHandler.removeUser(msg, game, socket));
  
    socket.on('start game', (msg) => socketHandler.start(publicId, msg, game, socket));
  
    socket.on('stop game', (_) => socketHandler.stop(game, games, io));
  
    socket.on('positionUpdate', (msg) => socketHandler.positionUpdate(msg, game, publicId));
  
    socket.on('chat message', (msg) => socketHandler.chatMsg(msg, game, socket, publicId, games, io));
    
    socket.on('bad snipe', (msg) => socketHandler.badSnipe(msg, game, socket, publicId));
  
    socket.on('disconnect', function () {
      logger.log('debug', 'socket disconnected', { 'player': publicId });
    });
  
}

export function resizeDone(socket: SocketIO.Socket, msg: socketEvents.ServerResizeDone){
  socket.nsp.emit('resize done', msg);  
}

export function makeTargets(socket: SocketIO.Socket, msg: socketEvents.ServerMakeTargetsMsg){
  socket.nsp.emit('make targets', msg);
}

export function undoMakeTargets(socket: SocketIO.Socket, msg: socketEvents.ServerUndoMakeTargetsMsg){
  socket.nsp.emit('undo make targets', msg);
}

export function removeUser(socket: SocketIO.Socket, msg: socketEvents.RemoveUserMsg){
  socket.nsp.emit('Remove user', msg);
}

export function start(socket: SocketIO.Socket, msg: socketEvents.ServerStartMsg){
  socket.nsp.emit('start', msg);
}

export function chatMessage(socket: SocketIO.Socket, msg: socketEvents.ServerChatMessage){
  socket.nsp.emit('chat message', msg);
}
export function badSnipe(socket: SocketIO.Socket, msg: socketEvents.ServerBadSnipeMsg){
  socket.nsp.emit('bad snipe', msg);
}

export function newUser(namespace: SocketIO.Namespace, msg: socketEvents.NewUserMsg){
  namespace.emit('New user', msg);
}

export function finished(namespace: SocketIO.Namespace, msg: socketEvents.ServerFinishedMsg){
  namespace.emit('game finished', msg);
}

export function timeLeft(namespace: SocketIO.Namespace, msg: socketEvents.ServerTimeLeftMsg){
  namespace.emit('timeLeft', msg)
}