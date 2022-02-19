import * as fs from "fs"
import * as fsPromises from "fs/promises"

import { ClientGame } from "../shared/game"
import * as api from "../shared/clientApi"
import path from "path"
import { setTimeout } from "timers/promises"

const msPerDay = 1000 * 60 * 60 * 24
const maxDaysOld = 7

export function cleanUpDaemon() {
  cleanUp()
  // guarantees games will be cleaned up after 101% of max days old
  setTimeout((msPerDay * maxDaysOld) / 100).then(cleanUp)
}

export async function cleanUp(): Promise<void> {
  const currentDate = new Date()
  console.log(`Checking for games to clean up at ${currentDate.toISOString()}`)
  await fsPromises.readdir(path.resolve("./games")).then((files) => {
    const fileCleanUps: Promise<void>[] = []
    for (const file of files) {
      const filePath = path.resolve(`./games/${file}`)
      const fileCleanup: Promise<void> = fsPromises
        .stat(filePath)
        .then((stats) => {
          const folderCreationDate = stats.mtime
          const diffInMs = currentDate.getTime() - folderCreationDate.getTime()
          const diffInDays = diffInMs / msPerDay
          if (diffInDays > maxDaysOld) {
            console.log(
              `cleaning ${file}, created at ${folderCreationDate.toISOString()}}`
            )
            return fsPromises.rm(filePath, { recursive: true })
          }
        })
      fileCleanUps.push(fileCleanup)
    }
    return Promise.all(fileCleanUps)
  })
}

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
