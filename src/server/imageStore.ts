import * as fs from "fs"

import { ClientGame } from "../shared/game"
import * as api from "../shared/clientApi"
import path from "path"

export function getUploadImageUrl(gameCode: string, id: number): string {
  return `/games/${gameCode}/image/${id}.webp`
}

export async function uploadImage(
  image: Buffer,
  gameCode: string,
  id: number
): Promise<string> {
  return upload(image, getUploadImageUrl(gameCode, id))
}

export function getUploadImageLowResUrl(gameCode: string, id: number): string {
  return `/games/${gameCode}/low-res/${id}.webp`
}

export async function uploadLowResImage(
  image: Buffer,
  gameCode: string,
  id: number
): Promise<string> {
  return upload(image, getUploadImageLowResUrl(gameCode, id))
}

// todo: verify the image type being uploaded
// and the size
async function upload(image: Buffer, filePath: string): Promise<string> {
  const fullFilePath = path.resolve("./" + filePath)
  return fs.promises
    .mkdir(path.dirname(fullFilePath), { recursive: true })
    .then(() => {
      return new Promise((resolve, reject) => {
        fs.writeFile(fullFilePath, image, function (err) {
          if (err) {
            reject(err)
          }
          resolve(filePath)
        })
      })
    })
}

// we only need to upload the client game
// as we only upload once the game is finished
// todo: if we would like to back up long running games
// we will have to separately upload the Server Game state
// to a non-public bucket
// but this would only be for the use case where a server crashes
// and needs to resume games
export async function uploadGameState(
  gameState: ClientGame,
  code: string
): Promise<string> {
  const asJson = JSON.stringify(gameState)
  const gamePath = api.gameStatePath(code)
  const fullFilePath = path.resolve("games/" + gamePath)
  return fs.promises
    .mkdir(path.dirname(fullFilePath), { recursive: true })
    .then(() => {
      return new Promise((resolve, reject) => {
        fs.writeFile(fullFilePath, asJson, function (err) {
          if (err) {
            reject(err)
          }
          resolve(`/games/${gamePath}`)
        })
      })
    })
}
