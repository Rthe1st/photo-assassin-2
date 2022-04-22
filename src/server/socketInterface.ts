import { logger } from "./logging"
import * as Game from "./game"
import * as socketEvents from "../shared/socketEvents"
import * as socketHandler from "./socketHandler"
import { Server, Socket } from "socket.io"
import { Record, String } from "runtypes"

// todo: remove the need for io to be passed in here
export function socketConnect(socket: Socket, game: Game.Game, io: Server) {
  const queryValidation = Record({
    privateId: String.withConstraint((id) =>
      game.idMapping.has(id) ? true : "id didn't exist"
    ),
  })

  const validationResult = queryValidation.validate(socket.handshake.query)

  if (!validationResult.success) {
    logger.log("error", JSON.stringify(validationResult.details))
    socket.emit("error", validationResult.details)
    socket.disconnect()
    return
  }

  const privateId = validationResult.value.privateId

  //todo: allow sockets to connect in "view only" mode if they're not players
  const publicId = game.idMapping.get(privateId)!

  logger.log("debug", "Socket connected", {
    publicId: publicId,
    gameCode: game.code,
  })

  const initializationMsg: socketEvents.ServerInitializationMsg = {
    gameState: Game.gameStateForClient(game),
    chatHistory: game.chatHistory,
  }
  socket.emit("initialization", initializationMsg)

  // todo: can we do a switch statement on socket event
  // and cast the event name to an enum, to check we cover all options?

  socket.on("update settings", (msg) => socketHandler.updateSettings(msg, game))

  socket.on("remove user", (msg) => socketHandler.removeUser(msg, game))

  socket.on("start game", (msg) => socketHandler.start(publicId, msg, game))

  socket.on("stop game", (_) => socketHandler.stop(game, io))

  socket.on("positionUpdate", (msg) =>
    socketHandler.positionUpdate(msg, game, publicId)
  )

  socket.on("chat message", (msg) =>
    socketHandler.chatMsg(msg, game, publicId, io)
  )

  socket.on("bad snipe", (msg) => socketHandler.badSnipe(msg, game, publicId))

  socket.on("disconnect", function () {
    logger.log("debug", "socket disconnected", { player: publicId })
  })
}

export type Listener = {
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
  const namespace = io.of(`/game/${code}`)
  namespace.on("connection", (socket) => socketConnect(socket, game, io))
  return {
    resizeDone: (msg: socketEvents.ServerResizeDone) =>
      namespace.emit("resize done", msg),
    imageUploadDone: (msg: socketEvents.ServerImageUploadDone) =>
      namespace.emit("image upload done", msg),
    updateSettings: (msg: socketEvents.ServerUpdateSettingsMsg) =>
      namespace.emit("update settings", msg),
    removeUser: (msg: socketEvents.RemoveUserMsg) =>
      namespace.emit("Remove user", msg),
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
