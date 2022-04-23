import { logger } from "./logging"
import * as Game from "./game"
import * as socketEvents from "../shared/socketEvents"

export function removeUser(
  msg: socketEvents.ClientRemoveUser,
  game: Game.Game
) {
  //todo: kill the socket connection of the removed user
  if (game.state != Game.states.NOT_STARTED) {
    return
  }
  Game.removePlayer(game, msg.publicId)
}

export function start(
  publicId: number,
  msg: socketEvents.ClientUpdateSettings,
  game: Game.Game
) {
  if (publicId != 0) {
    return
  }
  Game.updateSettings(
    game,
    msg.gameLength,
    msg.countDown,
    msg.proposedTargetList
  )
  logger.log("verbose", "Making targets", {
    gameCode: game.code,
    gameState: game.state,
  })
  Game.start(game)
  logger.log("verbose", "Starting", {
    gameCode: game.code,
    gameState: game.state,
  })
}

export function stop(game: Game.Game) {
  if (game.state == Game.states.IN_PLAY) {
    finishGame(game, "game stopped")
    logger.log("verbose", "Stopping", {
      gameCode: game.code,
      gameState: game.state,
    })
    // todo: say who stopped it
  }
}

export function positionUpdate(
  position: socketEvents.ClientPositionUpdate,
  game: Game.Game,
  publicId: number
) {
  Game.updatePosition(game, publicId, position)
}

export function chatMsg(
  msg: socketEvents.ClientChatMessage,
  game: Game.Game,
  publicId: number
) {
  if (game.state != Game.states.IN_PLAY) {
    logger.log("debug", "chat message while not IN_PLAY")
    return
  }

  logger.log("verbose", "Chat message", {
    gameCode: game.code,
    publicId: publicId,
    chatMessage: msg.text,
  })

  // snipes must contain an image
  // but not all images have to be snipes
  // for example, to send a selfie
  const wasSnipe =
    msg.isSnipe && msg.image && game.subState == Game.inPlaySubStates.PLAYING

  logger.log("debug", "positionUpdate", {
    positionHistory: game.positions.get(publicId),
    position: msg.position,
  })
  if (msg.position != undefined) {
    Game.updatePosition(game, publicId, msg.position)
  }

  // is there a better way of doing this?
  // we know socket IO turns the File type (client side) into a buffer
  const image = msg.image as Buffer

  let imageId: number | undefined
  let botMessage: any
  let snipeInfo: any
  if (image) {
    // 1000*1000 pixel image, 10 bytes per pixel
    // https://stackoverflow.com/questions/9806091/maximum-file-size-of-jpeg-image-with-known-dimensions
    // todo: move magic number to a ts file shared with resize client code
    // so they are in sync
    if (image.length > 1000 * 1000 * 10) {
      logger.log("error", "client sent image bigger then 10mb")
      // todo: push message to client to explain the error
      return
    }
    const res = Game.saveImage(game, image)
    imageId = res.imageId
    // because of this
    // https://developer.mozilla.org/en-US/docs/Web/JavaScript/EventLoop#run-to-completion
    // the image promises will always resolve AFTER the current message has been sent out
    // and as long as we are using WebSockets for sending the messages
    // they should arrive at the client in order
    // https://stackoverflow.com/a/41641451/5832565
    res.resizePromise
      .then((imageUrl) => {
        return game.listener!.resizeDone({
          imageId: imageId!,
          url: imageUrl,
        })
      })
      .catch((err) => {
        console.log("resize fail")
        console.log(err)
        // todo: handle better
        // for now, just leave it undefined so client sees loader image
      })

    res.imagePromise
      .then((imageUrl) => {
        return game.listener!.imageUploadDone({
          imageId: imageId!,
          url: imageUrl,
        })
      })
      .catch((err) => {
        console.log("upload fail")
        console.log(err)
        // todo: handle better
        // for now, just leave it undefined so client sees loader image
      })

    let gameOver: boolean

    if (wasSnipe) {
      ;({ botMessage, snipeInfo, gameOver } = Game.snipe(
        game,
        publicId,
        imageId,
        msg.position
      ))

      logger.log("verbose", "Snipe", {
        gameCode: game.code,
        gameState: game.state,
      })
      if (gameOver) {
        Game.updatePosition(game, publicId, msg.position!)
        finishGame(game, publicId.toString())
        return
      }
    }
  }

  const clientState = Game.gameStateForClient(game)

  // snipeInfo already contains imageID
  // maybe we should make this:
  // socketEvents.ServerChatMessageImage | socketEvents.ServerChatMessageSnipe
  // instead (and store the text in those types as well)
  // this will also help with stoing non-snipe images on the game obvject
  // for lookup in the archieve page
  const outgoingMsg: socketEvents.ServerChatMessage = {
    publicId: publicId,
    text: msg.text,
    imageId: imageId,
    gameState: clientState,
    snipeInfo: snipeInfo,
    botMessage: botMessage,
    nonce: msg.nonce,
  }

  game.chatHistory.push(outgoingMsg)

  game.listener!.chatMessage(outgoingMsg)
}

export function badSnipe(
  msg: socketEvents.ClientBadSnipe,
  game: Game.Game,
  publicId: number
) {
  const undoneSnipeIndexes = Game.badSnipe(game, msg.snipeInfosIndex, publicId)
  if (undoneSnipeIndexes) {
    //we need to tell the client which snipes need ot be marked as canceled in the gui
    //undosnipe should probs return that
    game.listener!.badSnipe({
      gameState: Game.gameStateForClient(game),
      undoneSnipeIndexes: undoneSnipeIndexes,
    })
  }
}

export function addUser(publicId: number, game: Game.Game) {
  game.listener!.newUser({
    publicId: publicId,
    gameState: Game.gameStateForClient(game),
  })
}

function finishGame(game: Game.Game, winner: string) {
  const nextGame = Game.generateGame(game.listener!.listenerFactory)

  // we wait for the gamestate to get uploaded
  // and only then tell clients the game is over
  // so that the state URL is ready for them
  // todo: alternative, tell them game is over ASAP
  // and implement retry logic client side to check
  // when the uploaded state is ready
  Game.finishGame(game, nextGame.code, winner).then((url) => {
    game.listener!.finished({
      nextCode: nextGame.code,
      winner: winner,
      stateUrl: url,
    })
    // once the state has been saved to disk
    // there's no need for us to keep it
    Game.games.delete(game.code)
  })
}

export function checkGameTiming(games: Map<string, Game.Game>) {
  for (const [gameId, game] of games.entries()) {
    const now = Date.now()
    //todo: need a record when we're in count down vs real game
    if (
      game.state == Game.states.IN_PLAY &&
      game.startTime! +
        game.chosenSettings.countDown +
        game.chosenSettings.gameLength <
        now
    ) {
      game.timeLeft = 0
      finishGame(game, "time")
      logger.log("verbose", "TimeUp", {
        gameCode: gameId,
        gameState: game.state,
      })
    } else if (game.state == Game.states.IN_PLAY) {
      const timeLeft =
        game.startTime! +
        game.chosenSettings.countDown +
        game.chosenSettings.gameLength -
        now

      logger.log("debug", "timeLeft", {
        gameCode: gameId,
        gameState: game.state,
        gameStartTime: game.startTime,
        gameLength: game.chosenSettings.gameLength,
        now: now,
        timeLeft: timeLeft,
      })

      game.timeLeft = timeLeft
      if (
        game.subState == Game.inPlaySubStates.COUNTDOWN &&
        timeLeft < game.chosenSettings.gameLength
      ) {
        game.subState = Game.inPlaySubStates.PLAYING
      }
      const forClient: socketEvents.ServerTimeLeftMsg = {
        gameState: Game.gameStateForClient(game),
      }
      game.listener!.timeLeft(forClient)
    }
  }
}
