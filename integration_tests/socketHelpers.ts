import * as socketClient from "../src/shared/socketClient"
import * as httpHelpers from "./httpHelpers"
import * as SocketEvents from "../src/shared/socketEvents"
import { Socket } from "socket.io-client"

//todo: have this buffer events it recieves
export async function makeSocket(
  domain: string,
  gameId: string,
  privateId: string
) {
  return new Promise<{
    socket: Socket
    msg: SocketEvents.ServerInitializationMsg
  }>((resolve, reject) => {
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
      domain
    )

    setTimeout(reject, 2000)
  })
}

export function socketCall(emit_fn: any, resolve_fn: any): Promise<any> {
  return new Promise<any>((resolve, reject) => {
    resolve_fn(resolve)
    emit_fn()
    setTimeout(reject, 100)
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
  const details = await (
    await httpHelpers.post(`${domain}/make`, `username=${username}&format=json`)
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
  const details = await (
    await httpHelpers.post(
      `${domain}/join`,
      `code=${gameId}&username=${username}&format=json`
    )
  ).json()
  const { socket: socket } = await makeSocket(domain, gameId, details.privateId)
  return socket
}
