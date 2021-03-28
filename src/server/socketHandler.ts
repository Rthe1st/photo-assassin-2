import { logger } from './logging'
import * as Game from './game'
import * as socketInterface from './socketInterface'
import * as socketEvents from '../shared/socketEvents'

export function updateSettings(msg: socketEvents.ClientUpdateSettings, game: Game.Game, socket: SocketIO.Socket) {
  if (game.state != Game.states.NOT_STARTED) {
    return;
  }
  Game.updateSettings(game, msg.gameLength, msg.countDown, msg.proposedTargetList);
  logger.log("verbose", "Making targets", { gameCode: game.code, gameState: game.state });
  socketInterface.updateSettings(socket, { gameState: Game.gameStateForClient(game) });
};

export function removeUser(msg: socketEvents.ClientRemoveUser, game: Game.Game, socket: SocketIO.Socket) {
  //todo: kill the socket connection of the removed user
  if (game.state != Game.states.NOT_STARTED) {
    return;
  }
  Game.removePlayer(game, msg.publicId);
  socketInterface.removeUser(socket, { publicId: msg.publicId, gameState: Game.gameStateForClient(game) });
};

export function start(publicId: number, msg: socketEvents.ClientUpdateSettings,game: Game.Game, socket: SocketIO.Socket) {
  if(publicId != 0){
    return;
  }
  Game.updateSettings(game, msg.gameLength, msg.countDown, msg.proposedTargetList);
  logger.log("verbose", "Making targets", { gameCode: game.code, gameState: game.state });
  Game.start(game);
  logger.log("verbose", "Starting", { gameCode: game.code, gameState: game.state });
  // todo: say who started it
  socketInterface.start(socket, { gameState: Game.gameStateForClient(game) });
};

export function stop(game: Game.Game, io: SocketIO.Server) {
  if (game.state == Game.states.IN_PLAY) {
    finishGame(game, 'game stopped', io);
    logger.log("verbose", "Stopping", { gameCode: game.code, gameState: game.state });
    // todo: say who stopped it
  }
};

export function positionUpdate(position: socketEvents.ClientPositionUpdate, game: Game.Game, publicId: number) {
  Game.updatePosition(game, publicId, position);
};

export function chatMsg(msg: socketEvents.ClientChatMessage, game: Game.Game, socket: SocketIO.Socket, publicId: number, io: SocketIO.Server) {
  if (game.state != Game.states.IN_PLAY) {
    logger.log("debug", "chat message while not IN_PLAY");
    return;
  }

  // is there a better way of doing this?
  // we know socket IO turns the File type (clientside) into a buffer
  let image = msg.image as Buffer;

  logger.log("verbose", "Chat message", { gameCode: game.code, publicId: publicId, chatMessage: msg.text });

  // snipes must contain an image
  // but not all images have to be snipes
  // for example, to send a selfie
  var wasSnipe = msg.isSnipe && msg.image && game.subState == Game.inPlaySubStates.PLAYING;

  logger.log("debug", "positionUpdate", { 'positionHistory': game.positions.get(publicId), 'position': msg.position });
  if(msg.position != undefined){
    Game.updatePosition(game, publicId, msg.position);
  }
  let imageId: number | undefined
  if (image) {
    let res = Game.saveImage(game, image);
    imageId = res.imageId
    res.resizePromise
      .then(lowRes => {
        game.lowResImages[imageId!] = lowRes
        socketInterface.resizeDone(socket, {imageId: imageId!});
      })
      .catch(err => {
        console.log(err);
        // this happens if file is bad type, etc
        // todo: handle better
        // for now, just leave it undefined so client sees loader image
      });

    if (wasSnipe) {
      var {botMessage: botMessage, snipeInfo: snipeInfo, gameOver: gameOver} = Game.snipe(game, publicId, imageId, msg.position);

      logger.log("verbose", "Snipe", { gameCode: game.code, gameState: game.state });
      if (gameOver) {
        Game.updatePosition(game, publicId, msg.position!);
        finishGame(game, publicId.toString(), io);
        return;
      }
    }
  }

  let clientState = Game.gameStateForClient(game)

  // snipeInfo already contains imageID
  // maybe we should make this:
  // socketEvents.ServerChatMessageImage | socketEvents.ServerChatMessageSnipe
  // instead (and store the text in those types as well)
  // this will also help with stoing non-snipe images on the game obvject
  // for lookup in the archieve page
  var outgoingMsg: socketEvents.ServerChatMessage = {
    publicId: publicId,
    text: msg.text,
    imageId: imageId,
    gameState: clientState,
    snipeInfo: snipeInfo,
    botMessage: botMessage,
    resizeIsAvailable: game.lowResImages[imageId!] != undefined,
    nonce: msg.nonce
  }

  game.chatHistory.push(outgoingMsg);

  socketInterface.chatMessage(socket, outgoingMsg)
};

export function badSnipe(msg: socketEvents.ClientBadSnipe, game: Game.Game, socket: SocketIO.Socket, publicId: number) {
    var undoneSnipeIndexes = Game.badSnipe(game, msg.snipeInfosIndex, publicId)
    if (undoneSnipeIndexes) {
      //we need to tell the client which snipes need ot be marked as canceled in the gui
      //undosnipe should probs return that
      socketInterface.badSnipe(socket, { gameState: Game.gameStateForClient(game), undoneSnipeIndexes: undoneSnipeIndexes })
    }
};

export function addUser(publicId: number, game: Game.Game) {
  socketInterface.newUser(game.namespace!, { publicId: publicId, gameState: Game.gameStateForClient(game) });
}

function finishGame(game: Game.Game, winner: string, io: SocketIO.Server) {

  let nextGame = socketInterface.setup(
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
      && game.startTime! + game.chosenSettings.gameLength < now) {
      finishGame(game, 'time', io)
      logger.log("verbose", "TimeUp", { gameCode: gameId, gameState: game.state });
    } else if (game.state == Game.states.IN_PLAY) {
      var timeLeft = game.startTime! + game.chosenSettings.countDown + game.chosenSettings.gameLength - now;

      logger.log("debug", "timeLeft",
        {
          gameCode: gameId,
          gameState: game.state,
          gameStartTime: game.startTime,
          gameLength: game.chosenSettings.gameLength,
          now: now,
          timeLeft: timeLeft,
        }
      );

      game.timeLeft = timeLeft;
      var forClient: socketEvents.ServerTimeLeftMsg = { gameState: Game.gameStateForClient(game) };
      if (game.subState == Game.inPlaySubStates.COUNTDOWN && timeLeft < game.chosenSettings.gameLength) {
        game.subState = Game.inPlaySubStates.PLAYING;
      }
      socketInterface.timeLeft(namespace!, forClient)
    }
  };
}
