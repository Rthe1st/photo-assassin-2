import { logger } from './logging.js'
import * as Game from './game.js'
import * as SharedGame from '../shared/game'
import socketIo from 'socket.io'
import * as socketEvents from '../shared/socketEvents'
export interface OutgoingMsg {
  publicId: number,
  text: string,
  image?: Buffer,
  snipeNumber?: number,
  snipePlayer?: number,
  snipeCount?: number,
  botMessage?: string,
  gameState?: SharedGame.ClientGame
}

export function ioConnect(socket: socketIo.Socket, games: Map<string, Game.Game>) {

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

  socket.emit('initialization', { gameState: Game.gameStateForClient(game), chatHistory: game.chatHistory });

  socket.on('make targets', function (msg: socketEvents.ClientMakeTargets) {
    if (game.state != Game.states.NOT_STARTED) {
      return;
    }
    Game.makeTargets(game, msg.gameLength, msg.countDown, msg.proposedTargetList);
    logger.log("verbose", "Making targets", { gameCode: gameId, gameState: game.state });
    // todo: say who made the targets
    socket.nsp.emit('make targets', { gameState: Game.gameStateForClient(game) });
  });

  socket.on('undo make targets', function () {
    if (game.state != Game.states.TARGETS_MADE) {
      return;
    }
    Game.undoMakeTargets(game);
    var gameState = Game.gameStateForClient(game);
    socket.nsp.emit('undo make targets', { gameState: gameState });
  });

  socket.on('remove user', function (msg: socketEvents.ClientRemoveUser) {
    //todo: kill the socket connection of the removed user
    if (game.state != Game.states.NOT_STARTED) {
      return;
    }
    Game.removePlayer(game, msg.publicId);
    socket.nsp.emit('Remove user', { publicId: msg.publicId, gameState: Game.gameStateForClient(game) });
  });

  socket.on('start game', function () {
    if (game.state != Game.states.TARGETS_MADE) {
      return;
    }
    Game.start(game);
    logger.log("verbose", "Starting", { gameCode: gameId, gameState: game.state });
    // todo: say who started it
    socket.nsp.emit('start', { gameState: Game.gameStateForClient(game) });
  });

  socket.on('stop game', function () {
    if (game.state == Game.states.IN_PLAY) {
      finishGame(game, 'game stopped', games);
      logger.log("verbose", "Stopping", { gameCode: gameId, gameState: game.state });
      // todo: say who stopped it
    }
  });

  socket.on('positionUpdate', function (position: socketEvents.ClientPositionUpdate) {
    Game.updatePosition(game, publicId, position);
  });

  socket.on('chat message', function (msg: socketEvents.ClientChatMessage) {
    if (game.state != Game.states.IN_PLAY) {
      logger.log("debug", "chat message while not IN_PLAY");
      return;
    }

    // is there a better way of doing this?
    // we know socket IO turns the File type (clientside) into a buffer
    let image = msg.image as Buffer;

    console.log('ingame chat msg');
    console.log(msg);

    logger.log("verbose", "Chat message", { gameCode: gameId, publicId: publicId, chatMessage: msg.text });

    var outgoing_msg: OutgoingMsg = {
      publicId: publicId,
      text: msg.text,
      image: image
    }

    // snipes must contain an image
    // but not all images have to be snipes
    // for example, to send a selfie
    var wasSnipe = msg.isSnipe && msg.image && game.subState == Game.inPlaySubStates.PLAYING;

    //todo: move snipe info off of position
    if (msg.position == undefined) {
      logger.log("debug", "chat message without position", { gameCode: gameId, position: msg.position });
      return
    }

    let snipeRes;
    let snipeNumber;
    let targetPosition;
    if (wasSnipe) {
      snipeRes = Game.snipe(game, publicId);
      msg.position.snipeInfo = snipeRes.snipeInfo;

      logger.log("verbose", "Snipe", { gameCode: gameId, gameState: game.state });
      if (snipeRes.gameOver) {
        Game.updatePosition(game, publicId, msg.position!);
        finishGame(game, publicId.toString(), games);
        return;
      }

      outgoing_msg["snipeNumber"] = snipeRes.snipeNumber;
      outgoing_msg["snipePlayer"] = publicId;
      outgoing_msg["snipeCount"] = snipeRes.snipeCount;
      outgoing_msg["botMessage"] = snipeRes.botMessage;

      targetPosition = snipeRes.snipeInfo.targetPosition;
      snipeNumber = snipeRes.snipeNumber;

    }

    if (msg.image) {
      Game.saveImage(game, image, publicId, snipeNumber, msg.position, targetPosition);
    }

    logger.log("debug", "positionUpdate", { 'positionHistory': game.positions.get(publicId), 'position': msg.position });
    Game.updatePosition(game, publicId, msg.position);

    game.chatHistory.push(outgoing_msg);

    outgoing_msg["gameState"] = Game.gameStateForClient(game);

    socket.nsp.emit('chat message', outgoing_msg);
  });

  socket.on('bad snipe', function (msg: socketEvents.ClientBadSnipe) {
    var undoneSnipes = Game.badSnipe(game, msg.sniperPlayer, msg.snipeNumber, publicId)
    if (undoneSnipes) {
      //we need to tell the client which snipes need ot be marked as canceled in the gui
      //undosnipe should probs return that
      socket.nsp.emit('bad snipe', { gameState: Game.gameStateForClient(game), snipePlayer: msg.sniperPlayer, undoneSnipes: undoneSnipes });
    }
  });

  socket.on('disconnect', function () {
    logger.log('debug', 'socket disconnected', { 'player': publicId });
  });

}

export function addUser(publicId: number, game: Game.Game) {
  game.namespace!.emit('New user', { publicId: publicId, gameState: Game.gameStateForClient(game) });
}

function finishGame(game: Game.Game, winner: string, games: Map<string, Game.Game>) {
  var nextGame = Game.generateGame(games.size);
  Game.finishGame(game, nextGame.code, winner);
  game.namespace!.emit('game finished', { nextCode: nextGame.code, winner: winner });
}

export function checkGameTiming(games: Map<string, Game.Game>) {
  for (let [gameId, game] of games.entries()) {
    let namespace = game.namespace;
    let now = Date.now();
    //todo: need a record when we're in count down vs real game
    if (game.state == Game.states.IN_PLAY
      && game.startTime! + game.gameLength! < now) {
      finishGame(game, 'time', games)
      logger.log("verbose", "TimeUp", { gameCode: gameId, gameState: game.state });
    } else if (game.state == Game.states.IN_PLAY) {
      var timeLeft = game.startTime! + game.countDown! + game.gameLength! - now;

      logger.log("debug", "timeLeft",
        {
          gameCode: gameId,
          gameState: game.state,
          gameStartTime: game.startTime,
          gameLength: game.gameLength,
          now: now,
          timeLeft: timeLeft,
        }
      );

      game.timeLeft = timeLeft;
      var forClient = { gameState: Game.gameStateForClient(game) };
      if (game.subState == Game.inPlaySubStates.COUNTDOWN && timeLeft < game.gameLength!) {
        game.subState = Game.inPlaySubStates.PLAYING;
      }
      namespace!.emit('timeLeft', forClient);
    }
  };
}
