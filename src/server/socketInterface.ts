import { logger } from "./logging"
import * as Game from "./game"
import * as socketEvents from "../shared/socketEvents"
import * as socketHandler from "./socketHandler"

Game.setup()

export function setup(io: SocketIO.Server) {
  var game = Game.generateGame()
  var namespace = io.of(`/game/${game.code}`)
  // I don't like namespace getting registered on game after game is already made
  game.namespace = namespace
  // register connection after setting game space to prevent race condition
  // where ioConnect relies on game.namespace
  namespace.on("connection", (socket) => socketConnect(socket, game, io))
  return game
}

function socketConnect(
  socket: SocketIO.Socket,
  game: Game.Game,
  io: SocketIO.Server
) {
  var gameId = socket.nsp.name.substr("/game/".length)

  if (game == undefined) {
    logger.log("verbose", `invalid game ${gameId}`)
    return
  }
  let privateId = socket.handshake.query.privateId

  //todo: allow sockets to connect in "view only" mode if they're not players
  let publicId = game.idMapping.get(privateId)!
  if (publicId == undefined) {
    logger.log("verbose", `invalid privateId ${privateId}`)
    return
  }

  logger.log("debug", "Socket connected", {
    publicId: publicId,
    gameCode: gameId,
  })

  let initializationMsg: socketEvents.ServerInitializationMsg = {
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

export function resizeDone(
  socket: SocketIO.Socket,
  msg: socketEvents.ServerResizeDone
) {
  socket.nsp.emit("resize done", msg)
}

export function imageUploadDone(
  socket: SocketIO.Socket,
  msg: socketEvents.ServerImageUploadDone
) {
  socket.nsp.emit("image upload done", msg)
}

export function updateSettings(
  socket: SocketIO.Socket,
  msg: socketEvents.ServerUpdateSettingsMsg
) {
  socket.nsp.emit("update settings", msg)
}

export function removeUser(
  socket: SocketIO.Socket,
  msg: socketEvents.RemoveUserMsg
) {
  socket.nsp.emit("Remove user", msg)
}

export function start(
  socket: SocketIO.Socket,
  msg: socketEvents.ServerStartMsg
) {
  socket.nsp.emit("start", msg)
}

export function chatMessage(
  socket: SocketIO.Socket,
  msg: socketEvents.ServerChatMessage
) {
  socket.nsp.emit("chat message", msg)
}
export function badSnipe(
  socket: SocketIO.Socket,
  msg: socketEvents.ServerBadSnipeMsg
) {
  socket.nsp.emit("bad snipe", msg)
}

export function newUser(
  namespace: SocketIO.Namespace,
  msg: socketEvents.NewUserMsg
) {
  namespace.emit("New user", msg)
}

export function finished(
  namespace: SocketIO.Namespace,
  msg: socketEvents.ServerFinishedMsg
) {
  namespace.emit("game finished", msg)
}

export function timeLeft(
  namespace: SocketIO.Namespace,
  msg: socketEvents.ServerTimeLeftMsg
) {
  namespace.emit("timeLeft", msg)
}
