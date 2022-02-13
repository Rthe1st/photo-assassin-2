import { logger } from "./logging"
import * as Game from "./game"
import * as socketEvents from "../shared/socketEvents"
import * as socketHandler from "./socketHandler"
import { Namespace, Server, Socket } from "socket.io"

export function setup(io: Server) {
  const game = Game.generateGame()
  const namespace = io.of(`/game/${game.code}`)
  // I don't like namespace getting registered on game after game is already made
  game.namespace = namespace
  // register connection after setting game space to prevent race condition
  // where ioConnect relies on game.namespace
  // tod: wrap socketConnect in a  try/catch to send err message to client and disconnect them
  namespace.on("connection", (socket) => socketConnect(socket, game, io))
  return game
}

function socketConnect(socket: Socket, game: Game.Game, io: Server) {
  const gameId = socket.nsp.name.substr("/game/".length)
  if (game == undefined) {
    logger.log("verbose", `invalid game ${gameId}`)
    return
  }

  if (Array.isArray(socket.handshake.query.privateId)) {
    logger.log(
      "error",
      `more then one private ID supplied: {socket.handshake.query.privateId}`
    )
    return
  }

  const privateId = <string>socket.handshake.query.privateId

  //todo: allow sockets to connect in "view only" mode if they're not players
  const publicId = game.idMapping.get(privateId)
  if (publicId === undefined) {
    logger.log("verbose", `invalid privateId ${privateId}`)
    return
  }

  logger.log("debug", "Socket connected", {
    publicId: publicId,
    gameCode: gameId,
  })

  const initializationMsg: socketEvents.ServerInitializationMsg = {
    gameState: Game.gameStateForClient(game),
    chatHistory: game.chatHistory,
  }
  socket.emit("initialization", initializationMsg)

  // todo: can we do a switch statement on socket event
  // and cast the event name to an enum, to check we cover all options?

  socket.on("update settings", (msg) =>
    socketHandler.updateSettings(msg, game, socket)
  )

  socket.on("remove user", (msg) => socketHandler.removeUser(msg, game, socket))

  socket.on("start game", (msg) =>
    socketHandler.start(publicId, msg, game, socket)
  )

  socket.on("stop game", (_) => socketHandler.stop(game, io))

  socket.on("positionUpdate", (msg) =>
    socketHandler.positionUpdate(msg, game, publicId)
  )

  socket.on("chat message", (msg) =>
    socketHandler.chatMsg(msg, game, socket, publicId, io)
  )

  socket.on("bad snipe", (msg) =>
    socketHandler.badSnipe(msg, game, socket, publicId)
  )

  socket.on("disconnect", function () {
    logger.log("debug", "socket disconnected", { player: publicId })
  })
}

export function resizeDone(socket: Socket, msg: socketEvents.ServerResizeDone) {
  socket.nsp.emit("resize done", msg)
}

export function imageUploadDone(
  socket: Socket,
  msg: socketEvents.ServerImageUploadDone
) {
  socket.nsp.emit("image upload done", msg)
}

export function updateSettings(
  socket: Socket,
  msg: socketEvents.ServerUpdateSettingsMsg
) {
  socket.nsp.emit("update settings", msg)
}

export function removeUser(socket: Socket, msg: socketEvents.RemoveUserMsg) {
  socket.nsp.emit("Remove user", msg)
}

export function start(socket: Socket, msg: socketEvents.ServerStartMsg) {
  socket.nsp.emit("start", msg)
}

export function chatMessage(
  socket: Socket,
  msg: socketEvents.ServerChatMessage
) {
  socket.nsp.emit("chat message", msg)
}
export function badSnipe(socket: Socket, msg: socketEvents.ServerBadSnipeMsg) {
  socket.nsp.emit("bad snipe", msg)
}

export function newUser(namespace: Namespace, msg: socketEvents.NewUserMsg) {
  namespace.emit("New user", msg)
}

export function finished(
  namespace: Namespace,
  msg: socketEvents.ServerFinishedMsg
) {
  namespace.emit("game finished", msg)
}

export function timeLeft(
  namespace: Namespace,
  msg: socketEvents.ServerTimeLeftMsg
) {
  namespace.emit("timeLeft", msg)
}
