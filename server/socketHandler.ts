import { logger } from './logging.js'
import * as Game from './game.js'
import * as socketInterface from './socketInterface.js'
import * as socketEvents from '../shared/socketEvents.js'

export function makeTargets(msg: socketEvents.ClientMakeTargets, game: Game.Game, socket: SocketIO.Socket) {
  if (game.state != Game.states.NOT_STARTED) {
    return;
  }
  Game.makeTargets(game, msg.gameLength, msg.countDown, msg.proposedTargetList);
  logger.log("verbose", "Making targets", { gameCode: game.code, gameState: game.state });
  // todo: say who made the targets
  socketInterface.makeTargets(socket, { gameState: Game.gameStateForClient(game) });
};

export function undoMakeTargets(game: Game.Game, socket: SocketIO.Socket) {
  if (game.state != Game.states.TARGETS_MADE) {
    return;
  }
  Game.undoMakeTargets(game);
  socketInterface.undoMakeTargets(socket, {gameState: Game.gameStateForClient(game)})
};

export function removeUser(msg: socketEvents.ClientRemoveUser, game: Game.Game, socket: SocketIO.Socket) {
  //todo: kill the socket connection of the removed user
  if (game.state != Game.states.NOT_STARTED) {
    return;
  }
  Game.removePlayer(game, msg.publicId);
  socketInterface.removeUser(socket, { publicId: msg.publicId, gameState: Game.gameStateForClient(game) });
};

export function start(game: Game.Game, socket: SocketIO.Socket) {
  if (game.state != Game.states.TARGETS_MADE) {
    return;
  }
  Game.start(game);
  logger.log("verbose", "Starting", { gameCode: game.code, gameState: game.state });
  // todo: say who started it
  socketInterface.start(socket, { gameState: Game.gameStateForClient(game) });
};

export function stop(game: Game.Game, games: Map<string, Game.Game>, io: SocketIO.Server) {
  if (game.state == Game.states.IN_PLAY) {
    finishGame(game, 'game stopped', games, io);
    logger.log("verbose", "Stopping", { gameCode: game.code, gameState: game.state });
    // todo: say who stopped it
  }
};

export function positionUpdate(position: socketEvents.ClientPositionUpdate, game: Game.Game, publicId: number) {
  Game.updatePosition(game, publicId, position);
};

export function chatMsg(msg: socketEvents.ClientChatMessage, game: Game.Game, socket: SocketIO.Socket, publicId: number, games: Map<string, Game.Game>, io: SocketIO.Server) {
  if (game.state != Game.states.IN_PLAY) {
    logger.log("debug", "chat message while not IN_PLAY");
    return;
  }

  // is there a better way of doing this?
  // we know socket IO turns the File type (clientside) into a buffer
  let image = msg.image as Buffer;

  console.log('ingame chat msg');
  console.log(msg);

  logger.log("verbose", "Chat message", { gameCode: game.code, publicId: publicId, chatMessage: msg.text });

  // snipes must contain an image
  // but not all images have to be snipes
  // for example, to send a selfie
  var wasSnipe = msg.isSnipe && msg.image && game.subState == Game.inPlaySubStates.PLAYING;

  //todo: move snipe info off of position
  if (msg.position == undefined) {
    logger.log("debug", "chat message without position", { gameCode: game.code, position: msg.position });
    return
  }

  logger.log("debug", "positionUpdate", { 'positionHistory': game.positions.get(publicId), 'position': msg.position });
  Game.updatePosition(game, publicId, msg.position);

  let snipeRes;
  let snipeInfo: socketEvents.SnipeInfo|undefined = undefined;
  let targetPosition;
  let botMessage;
  if (wasSnipe) {
    snipeRes = Game.snipe(game, publicId);
    msg.position.snipeInfo = snipeRes.snipeInfo;

    logger.log("verbose", "Snipe", { gameCode: game.code, gameState: game.state });
    if (snipeRes.gameOver) {
      Game.updatePosition(game, publicId, msg.position!);
      finishGame(game, publicId.toString(), games, io);
      return;
    }

    snipeInfo = {
      snipeNumber: snipeRes.snipeNumber,
      snipePlayer: publicId,
      snipeCount: snipeRes.snipeCount
    }
    botMessage = snipeRes.botMessage;

    targetPosition = snipeRes.snipeInfo.targetPosition;
  }

  if (msg.image) {
    let snipeNumber;
    if(wasSnipe){
      snipeNumber = snipeInfo!.snipeNumber;
    }
    Game.saveImage(game, image, publicId, snipeNumber, msg.position, targetPosition);
  }

  let clientState = Game.gameStateForClient(game)

  game.chatHistory.push(clientState);

  var outgoingMsg = {
    publicId: publicId,
    text: msg.text,
    image: image,
    gameState: clientState,
    snipeInfo: snipeInfo,
    botMessage: botMessage
  }

  socketInterface.chatMessage(socket, outgoingMsg)
};

export function badSnipe(msg: socketEvents.ClientBadSnipe, game: Game.Game, socket: SocketIO.Socket, publicId: number) {
    var undoneSnipes = Game.badSnipe(game, msg.sniperPlayer, msg.snipeNumber, publicId)
    if (undoneSnipes) {
      //we need to tell the client which snipes need ot be marked as canceled in the gui
      //undosnipe should probs return that
      socketInterface.badSnipe(socket, { gameState: Game.gameStateForClient(game), snipePlayer: msg.sniperPlayer, undoneSnipes: undoneSnipes })
    }
};

export function addUser(publicId: number, game: Game.Game) {
  socketInterface.newUser(game.namespace!, { publicId: publicId, gameState: Game.gameStateForClient(game) });
}

function finishGame(game: Game.Game, winner: string, games: Map<string, Game.Game>, io: SocketIO.Server) {

  let nextGame = socketInterface.setup(
    games,
    io
  )

  Game.finishGame(game, nextGame.code, winner);

  socketInterface.finished(game.namespace!, { nextCode: nextGame.code, winner: winner })
}

export function checkGameTiming(games: Map<string, Game.Game>, io: SocketIO.Server) {
  for (let [gameId, game] of games.entries()) {
    let namespace = game.namespace;
    let now = Date.now();
    //todo: need a record when we're in count down vs real game
    if (game.state == Game.states.IN_PLAY
      && game.startTime! + game.gameLength! < now) {
      finishGame(game, 'time', games, io)
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
      var forClient: socketEvents.ServerTimeLeftMsg = { gameState: Game.gameStateForClient(game) };
      if (game.subState == Game.inPlaySubStates.COUNTDOWN && timeLeft < game.gameLength!) {
        game.subState = Game.inPlaySubStates.PLAYING;
      }
      socketInterface.timeLeft(namespace!, forClient)
    }
  };
}
