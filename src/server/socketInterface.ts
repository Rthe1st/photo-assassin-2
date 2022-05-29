import { logger } from "./logging"
import * as Game from "./game"
import * as socketEvents from "../shared/socketEvents"
import * as socketHandler from "./socketHandler"
import { Server, Socket } from "socket.io"
import { Record, String, Number, Array } from "runtypes"

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

  socket.on("stop game", (_) => socketHandler.stop(game))

  socket.on("positionUpdate", (msg) =>
    socketHandler.positionUpdate(msg, game, publicId)
  )

  socket.on("chat message", (msg) => socketHandler.chatMsg(msg, game, publicId))

  socket.on("bad snipe", (msg) => socketHandler.badSnipe(msg, game, publicId))

  socket.on("disconnect", function () {
    logger.log("debug", "socket disconnected", { player: publicId })
  })
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
    socketConnect(socket, game, socketIdMappings.set)
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
    finished: (msg: socketEvents.ServerFinishedMsg) =>
      namespace.emit("game finished", msg),
    timeLeft: (msg: socketEvents.ServerTimeLeftMsg) =>
      namespace.emit("timeLeft", msg),
  }
}
