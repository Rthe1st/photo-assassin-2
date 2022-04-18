import * as socketClient from "../src/shared/socketClient"
import * as httpHelpers from "./httpHelpers"
import * as SocketEvents from "../src/shared/socketEvents"
import { Socket } from "socket.io-client"

//todo: have this buffer events it recieves
export async function makeSocket(
  domain: string,
  gameId: string,
  privateId: string
): Promise<{
  socket: Socket
  msg: SocketEvents.ServerInitializationMsg
}> {
  return new Promise<{
    socket: Socket
    msg: SocketEvents.ServerInitializationMsg
  }>((resolve, _reject) => {
    const socket = socketClient.setup(
      gameId,
      privateId,
      (msg) => {
        resolve({ socket, msg })
      },
      () => {
        //todo
      },
      () => {
        //todo
      },
      () => {
        //todo
      },
      () => {
        //todo
      },
      () => {
        //todo
      },
      () => {
        //todo
      },
      () => {
        //todo
      },
      (_) => {
        //todo
      },
      () => {
        //todo
      },
      () => {
        //todo
      },
      domain,
      () => {
        // don't log disconnects
      }
    )
  })
}

export function socketCall(emit_fn: any, resolve_fn: any): Promise<any> {
  return new Promise<any>((resolve, reject) => {
    resolve_fn(resolve)
    emit_fn()
    setTimeout(reject, 2000)
  })
}

export function startGame(
  socket: Socket,
  msg: SocketEvents.ClientUpdateSettings
): Promise<SocketEvents.ServerStartMsg> {
  const emit_fn = () => socketClient.startGame(socket, msg)
  const resolve_fn = (resolve: any) => socket.on("start", resolve)
  return socketCall(emit_fn, resolve_fn)
}

export function stopGame(socket: Socket): Promise<SocketEvents.ServerStartMsg> {
  const emit_fn = () => socketClient.stopGame(socket)
  const resolve_fn = (resolve: any) => socket.on("game finished", resolve)
  return socketCall(emit_fn, resolve_fn)
}

export async function makeGame(domain: string, username: string) {
  const details: any = await (
    await httpHelpers.post(`${domain}/api/make`, `username=${username}`)
  ).json()

  const { socket: socket } = await makeSocket(
    domain,
    details.gameId,
    details.privateId
  )
  return [socket, details.gameId]
}

export async function joinGame(
  domain: string,
  gameId: string,
  username: string
) {
  const details: any = await (
    await httpHelpers.post(
      `${domain}/api/join`,
      `code=${gameId}&username=${username}`
    )
  ).json()
  const { socket: socket } = await makeSocket(domain, gameId, details.privateId)
  return socket
}

export async function closeSockets(sockets: Socket[]): Promise<void> {
  for (const socket of sockets) {
    socket.close()
  }

  function sleep(ms: number) {
    return new Promise((resolve) => setTimeout(resolve, ms))
  }

  for (;;) {
    let anyStillConnected = false

    for (const socket of sockets) {
      anyStillConnected = anyStillConnected || socket.connected
    }

    if (anyStillConnected) {
      await sleep(50)
    } else {
      return
    }
  }
}
