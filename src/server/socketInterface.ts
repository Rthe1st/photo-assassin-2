import { logger } from "./logging"
import * as Game from "./game"
import * as socketEvents from "../shared/socketEvents"
import * as socketHandler from "./socketHandler"
import { Server, Socket } from "socket.io"
import { Record, String, Number, Array } from "runtypes"
import { uploadGameState } from "./imageStore"
import { setTimeout } from "timers/promises"

export function socketConnect(
  socket: Socket,
  game: Game.Game,
  saveSocketId: (publicId: number, socketId: string) => void
) {
  const queryValidation = Record({
    privateId: String.withConstraint((id) =>
      game.idMapping.has(id) ? true : "id didn't exist"
    ),
  })

  const validationResult = queryValidation.validate(socket.handshake.query)

  if (!validationResult.success) {
    socket.emit("error", validationResult.details)
    socket.disconnect()
    return
  }

  const privateId = validationResult.value.privateId

  //todo: allow sockets to connect in "view only" mode if they're not players
  const publicId = game.idMapping.get(privateId)!

  saveSocketId(publicId, socket.id)

  logger.log("debug", "Socket connected", {
    publicId: publicId,
    gameCode: game.code,
  })

  const initializationMsg: socketEvents.ServerInitializationMsg = {
    gameState: Game.gameStateForClient(game),
    chatHistory: game.chatHistory,
  }
  socket.emit("initialization", initializationMsg)

  // cast the event name to an enum, to check we cover all options?

  socket.on("update settings", (msg) =>
    receiveUpdateSettings(socket, game, msg)
  )

  socket.on("remove user", (msg) => {
    removeUser(msg, game, socket)
  })

  socket.on("start game", () => start(game, socket))

  socket.on("stop game", () => stop(game, socket))

  socket.on("positionUpdate", (msg) =>
    socketHandler.positionUpdate(msg, game, publicId)
  )

  socket.on("chat message", (msg) => socketHandler.chatMsg(msg, game, publicId))

  socket.on("bad snipe", (msg) => socketHandler.badSnipe(msg, game, publicId))

  socket.on("disconnect", function () {
    logger.log("debug", "socket disconnected", { player: publicId })
  })
}

export async function stop(game: Game.Game, socket: Socket) {
  // todo: type winner more strictly
  const winner = "game stopped"
  const result = Game.finishGame(game, winner)
  if (result._tag == "Left") {
    socket.emit("error", result.left.message)
  }
}

export function start(game: Game.Game, socket: Socket) {
  const startResult = Game.start(game)

  if (startResult._tag == "Left") {
    socket.emit("error", startResult.left.message)
  }
}

export function removeUser(msg: any, game: Game.Game, socket: Socket) {
  const validation = Record({
    publicId: Number,
  })

  const result = validation.validate(msg)

  if (!result.success) {
    socket.emit("error", result.details)
    return
  }

  const res = Game.removePlayer(game, msg.publicId)
  if (res._tag == "Left") {
    socket.emit("error", res.left.message)
  }
}

export function receiveUpdateSettings(
  socket: Socket,
  game: Game.Game,
  msg: unknown
) {
  const validation = Record({
    gameLength: Number,
    countDown: Number,
    proposedTargetList: Array(Number),
  })

  const result = validation.validate(msg)

  if (!result.success) {
    socket.emit("error", result.details)
    return
  }

  const updateResult = Game.updateSettings(
    game,
    result.value.gameLength,
    result.value.countDown,
    result.value.proposedTargetList
  )

  if (!updateResult.success) {
    socket.emit("error", updateResult.details)
  }
}

export type Listener = {
  listenerFactory: (code: string, game: Game.Game) => Listener
  resizeDone: (msg: socketEvents.ServerResizeDone) => void
  imageUploadDone: (msg: socketEvents.ServerImageUploadDone) => void
  updateSettings: (msg: socketEvents.ServerUpdateSettingsMsg) => void
  removeUser: (msg: socketEvents.RemoveUserMsg) => void
  start: (msg: socketEvents.ServerStartMsg) => void
  chatMessage: (msg: socketEvents.ServerChatMessage) => void
  badSnipe: (msg: socketEvents.ServerBadSnipeMsg) => void
  newUser: (msg: socketEvents.NewUserMsg) => void
  finished: (msg: socketEvents.ServerFinishedMsg) => void
  timeLeft: (msg: socketEvents.ServerTimeLeftMsg) => void
}

export function socketListener(
  io: Server,
  code: string,
  game: Game.Game
): Listener {
  const socketIdMappings = new Map()

  const namespace = io.of(`/game/${code}`)
  namespace.on("connection", (socket) =>
    socketConnect(socket, game, socketIdMappings.set.bind(socketIdMappings))
  )
  return {
    listenerFactory: (code: string, game: Game.Game) =>
      socketListener(io, code, game),
    resizeDone: (msg: socketEvents.ServerResizeDone) =>
      namespace.emit("resize done", msg),
    imageUploadDone: (msg: socketEvents.ServerImageUploadDone) =>
      namespace.emit("image upload done", msg),
    updateSettings: (msg: socketEvents.ServerUpdateSettingsMsg) =>
      namespace.emit("update settings", msg),
    removeUser: (msg: socketEvents.RemoveUserMsg) => {
      namespace.emit("Remove user", msg)
      const socketId = socketIdMappings.get(msg.publicId)
      namespace.sockets.get(socketId)?.disconnect()
    },

    start: (msg: socketEvents.ServerStartMsg) => namespace.emit("start", msg),
    chatMessage: (msg: socketEvents.ServerChatMessage) =>
      namespace.emit("chat message", msg),
    badSnipe: (msg: socketEvents.ServerBadSnipeMsg) =>
      namespace.emit("bad snipe", msg),
    newUser: (msg: socketEvents.NewUserMsg) => namespace.emit("New user", msg),
    finished: async (msg: socketEvents.ServerFinishedMsg) => {
      namespace.emit("game finished", msg)
      // todo: delay the creation of next game untill a user clicks "next game"
      // by having that (clientside) send a REST req that checks if
      // a next game code exists for $oldgamecode (from saved state)
      // if it does - send to join page for that
      // if it doesn't - create a game and save its code to the old games state
      const nextGame = Game.generateGame(game.listener!.listenerFactory)
      game.nextCode = nextGame.code
      const clientGameState = Game.gameStateForClient(game)
      await uploadGameState(clientGameState, game.code)
        .catch(async () => {
          await setTimeout(1000)
          return uploadGameState(clientGameState, game.code)
        })
        .catch(async () => {
          await setTimeout(5000)
          return uploadGameState(clientGameState, game.code)
        })
        .catch(async () => {
          namespace.emit("error", "couldn't save finished game state")
        })
        .then((stateUrl) => {
          Game.games.delete(game.code)
          namespace.emit("game state saved", { stateUrl })
        })
    },
    timeLeft: (msg: socketEvents.ServerTimeLeftMsg) =>
      namespace.emit("timeLeft", msg),
  }
}
