import * as crypto from "crypto"
import { shuffle } from "../shared/shuffle"
import * as SharedGame from "../shared/game"
import * as SocketEvents from "../shared/socketEvents"
import sharp from "sharp"
import { commonWords } from "./commonWords"

import * as imageStore from "./imageStore"

import { logger } from "./logging"
import { Listener } from "./socketInterface"
import { addUser } from "./socketHandler"
import { Record } from "runtypes"
import * as runtypes from "runtypes"
import { isInteger } from "mathjs"
import { Either, left, right } from "fp-ts/lib/Either"

// todo: we should wrap this in a class
// it'd make it easier to test
export const games: Map<string, Game> = new Map()

const maxGameLength = 60

const states = Object.freeze({
  FINISHED: "FINISHED",
  NOT_STARTED: "NOT STARTED",
  IN_PLAY: "IN PLAY",
})

const inPlaySubStates = Object.freeze({
  COUNTDOWN: "COUNTDOWN",
  PLAYING: "PLAYING",
})

export interface Game {
  chosenSettings: SharedGame.Settings
  code: string
  // todo: make enum
  state: string
  //substate is used for dividing the in play state in countdown and playing, for example
  subState: string | undefined
  // this maps the private ID given to a client via a cookie
  // to an ID that is shown to other players
  // if other players learn your private ID, they can impersonate you
  idMapping: Map<string, number>
  nextId: 0 //includes old users - used to get a historically unique id for a user
  userList: Map<number, { username: string }>
  targets: { [key: number]: number[] }
  targetsGot: { [key: number]: number[] }
  positions: Map<number, SharedGame.Position[]>
  startTime: number | undefined
  timeLeft: number | undefined
  nextCode: string | undefined
  // this is used to look up the current head of a players snipeInfos
  latestSnipeIndexes: { [key: number]: number | undefined }
  snipeInfos: SharedGame.SnipeInfo[]
  winner: string | undefined
  // this includes images and so will get huge
  // todo: make client smart so it only requests those its missing
  // / saves what its already seen to local storage
  // and consider off loading images to cdn
  // todo: instead of saving images directly in here, we should point
  // to those in the images key
  // (and even that should just be a ref to images stored not in memory)
  chatHistory: SocketEvents.ServerChatMessage[]
  nextImageId: number
  imageUploadsDone: (string | undefined)[]
  // used to give thumbnail to user
  // (we only expand to full image when they click)
  lowResUploadsDone: (string | undefined)[]
  // this is used by the game object to notify
  // other code of events
  // in production this will send websocket events
  listener?: Listener
}

function newGame(code: string): Game {
  return {
    chosenSettings: {
      gameLength: 25 * 60 * 1000,
      countDown: 5 * 60 * 1000,
      proposedTargetList: [],
    },
    code: code,
    state: states.NOT_STARTED,
    subState: undefined,
    idMapping: new Map(),
    nextId: 0,
    userList: new Map(),
    targets: {},
    targetsGot: {},
    positions: new Map(),
    // we could avoid a lot of undefined if we put them on another type like `ingamestate`
    startTime: undefined,
    timeLeft: undefined,
    nextCode: undefined,
    latestSnipeIndexes: [],
    snipeInfos: [],
    chatHistory: [],
    nextImageId: 0,
    imageUploadsDone: [],
    lowResUploadsDone: [],
    winner: undefined,
    // todo: find a way of defining this at construction time
    listener: undefined,
  }
}

export function saveImage(
  game: Game,
  image: Buffer
): {
  imageId: number
  resizePromise: Promise<string>
  imagePromise: Promise<string>
} {
  const imageId = game.nextImageId
  // we put the urls in the game state even before the upload is done
  // so that if the game is marked as finished
  // the game state uploaded to goog already has the right URL links
  // this means we don't have to wait for the final snipe image to upload
  // before telling players the game is over
  game.imageUploadsDone.push(imageStore.getUploadImageUrl(game.code, imageId))
  game.lowResUploadsDone.push(
    imageStore.getUploadImageLowResUrl(game.code, imageId)
  )
  game.nextImageId += 1
  const asWebp = sharp(image).webp()
  const imagePromise = asWebp
    .toBuffer()
    .catch((e) => {
      console.log(e)
      return e
    })
    .then((buffer) => {
      return imageStore.uploadImage(buffer, game.code, imageId)
    })
    .then((url) => {
      return url
    })

  const resizePromise = asWebp
    .resize(100, 100) //todo: choose a better size
    .toBuffer()
    .then((lowResBuffer) => {
      return imageStore.uploadLowResImage(lowResBuffer, game.code, imageId)
    })
    .then((url) => {
      return url
    })

  return {
    imageId: imageId,
    resizePromise: resizePromise,
    imagePromise: imagePromise,
  }
}

export function updateSettings(
  game: Game,
  gameLength: number,
  countDown: number,
  proposedTargetList: number[]
) {
  const validation = Record({
    gameLength: runtypes.Number.withConstraint((n) => n > 0, {
      name: "is more then 0",
    })
      .withConstraint((n) => isInteger(n), { name: "is integer" })
      .withConstraint((n) => n <= maxGameLength, {
        name: `is less then or equal to ${maxGameLength}`,
      }),
    countDown: runtypes.Number.withConstraint((n) => n > 0, {
      name: "is more then 0",
    })
      .withConstraint((n) => isInteger(n), { name: "is integer" })
      .withConstraint((n) => n < gameLength, { name: "less then game length" }),
    proposedTargetList: runtypes
      .Array(
        runtypes.Number.withConstraint((n) => n >= 0, { name: "is 0 or more" })
          .withConstraint((n) => isInteger(n), { name: "is integer" })
          .withConstraint((n) => n <= game.idMapping.size, {
            name: "less then or equal to max player ID",
          })
      )
      .withConstraint((targets) => targets.length == game.idMapping.size, {
        name: "matches number of players in game",
      })
      .withConstraint(
        (targets) => {
          const targetsSeenAlready = new Set()

          for (const proposedTarget of targets) {
            if (targetsSeenAlready.has(proposedTarget)) {
              return false
            }
            targetsSeenAlready.add(proposedTarget)
          }
          return true
        },
        { name: "no duplicate targets" }
      ),
    gameState: runtypes.String.withConstraint(
      (gs) => gs == states.NOT_STARTED,
      { name: "game stats is NOT_STARTED" }
    ),
  })

  const result = validation.validate({
    gameLength,
    countDown,
    proposedTargetList,
    gameState: game.state,
  })

  if (result.success) {
    game.chosenSettings = {
      gameLength,
      countDown,
      proposedTargetList,
    }
    game.listener!.updateSettings({
      gameState: gameStateForClient(game),
    })
  }

  return result
}

function start(game: Game): Either<Error, void> {
  if (game.state != states.NOT_STARTED) {
    return left(new Error(`cannot start a game in state ${game.state}`))
  }

  game.startTime = Date.now()
  const chosenSettings = game.chosenSettings
  for (let i = 0; i < game.chosenSettings.proposedTargetList.length; i++) {
    const targetsBeforePlayer = chosenSettings.proposedTargetList.slice(i + 1)
    const targetsAfterPlayer = chosenSettings.proposedTargetList.slice(0, i)
    const player = chosenSettings.proposedTargetList[i]
    game.targets[player] = targetsBeforePlayer.concat(targetsAfterPlayer)
    game.targetsGot[player] = []
  }
  game.state = states.IN_PLAY
  if (game.chosenSettings.countDown) {
    game.subState = inPlaySubStates.COUNTDOWN
  } else {
    game.subState = inPlaySubStates.PLAYING
  }
  // todo: say who started it
  game.listener!.start({ gameState: gameStateForClient(game) })

  return right(undefined)
}

function snipe(
  game: Game,
  sniperPublicId: number,
  imageId: number,
  position?: SharedGame.Position
): {
  gameOver: boolean
  snipeInfo: SharedGame.SnipeInfo
  botMessage: string | undefined
} {
  const snipedId = game.targets[sniperPublicId][0]

  const targetPosition =
    game.positions.get(snipedId)![game.positions.get(snipedId)!.length - 1]

  const usernameWhoDidSniping = game.userList.get(sniperPublicId)?.username
  const usernameThatGotSniped = game.userList.get(
    game.targets[sniperPublicId][0]
  )?.username
  //todo: move botmessage computation to client side
  const botMessage = usernameWhoDidSniping + " sniped " + usernameThatGotSniped

  const targets = game.targets[sniperPublicId]

  //targets[0] becomes the new target
  game.targetsGot[sniperPublicId].push(targets.shift()!)
  const gameOver = targets.length == 0

  const snipeInfo = {
    index: game.snipeInfos.length,
    snipePlayer: sniperPublicId,
    target: snipedId,
    votes: [],
    imageId,
    targetPosition: targetPosition,
    position: position,
    previousSnipe: game.latestSnipeIndexes[sniperPublicId],
    nextSnipe: undefined,
    undoneNextSnipes: [],
    undone: false,
  }

  game.snipeInfos.push(snipeInfo)

  game.latestSnipeIndexes[sniperPublicId] = snipeInfo.index

  return { gameOver: gameOver, snipeInfo: snipeInfo, botMessage: botMessage }
}

function undoSnipe(game: Game, snipeInfo: SocketEvents.SnipeInfo): number[] {
  const undoneSnipeIndexes: number[] = [snipeInfo.index]
  snipeInfo.undone = true
  game.targets[snipeInfo.snipePlayer].unshift(
    game.targetsGot[snipeInfo.snipePlayer].pop()!
  )

  const previousSnipeIndex = snipeInfo.previousSnipe
  if (previousSnipeIndex == undefined) {
    game.latestSnipeIndexes[snipeInfo.snipePlayer] = undefined
  } else {
    game.latestSnipeIndexes[snipeInfo.snipePlayer] = previousSnipeIndex
    const previousSnipe = game.snipeInfos[previousSnipeIndex]
    previousSnipe.undoneNextSnipes.push(snipeInfo.index)
    previousSnipe.nextSnipe = undefined
  }

  while (snipeInfo.nextSnipe != undefined) {
    undoneSnipeIndexes.push(snipeInfo.nextSnipe)
    snipeInfo = game.snipeInfos[snipeInfo.nextSnipe]
    snipeInfo.undone = true
    // note that the target being shifted here
    // is NOT the target of the current snipeInfo
    // we just know that the number of times we shift
    // matches the total number of links we're going to
    // travel forward
    game.targets[snipeInfo.snipePlayer].unshift(
      game.targetsGot[snipeInfo.snipePlayer].pop()!
    )
  }

  return undoneSnipeIndexes
}

function gameStateForClient(game: Game) {
  const state: SharedGame.ClientGame = {
    chosenSettings: game.chosenSettings,
    userList: Object.fromEntries(game.userList),
    targets: game.targets,
    targetsGot: game.targetsGot,
    timeLeft: game.timeLeft,
    state: game.state,
    subState: game.subState,
    winner: game.winner,
    nextCode: game.nextCode,
    snipeInfos: game.snipeInfos,
    latestSnipeIndexes: game.latestSnipeIndexes,
    imageUploadsDone: game.imageUploadsDone,
    lowResUploadsDone: game.lowResUploadsDone,
  }

  // todo: we should have a whole different type interface for finished games
  if (game.state == states.FINISHED) {
    state["positions"] = Object.fromEntries(game.positions.entries())
  }

  return state
}

export const maxPlayers = 10
export const maxUsernameLength = 50

export function addPlayer(
  game: Game,
  username: string
): Either<runtypes.Failure | Error, { privateId: string; publicId: number }> {
  const existingUsernames = new Set(
    Array.from(game.userList.values()).map((v) => v.username)
  )

  const usernameValidation = runtypes.String.withConstraint(
    (username: string) => username.length > 0
  )
    .withConstraint((username) => username.length <= maxUsernameLength)
    .withConstraint((username) => !existingUsernames.has(username))

  const usernameResult = usernameValidation.validate(username)

  if (!usernameResult.success) {
    return left(
      new Error(
        `You cannot use '${username}' as a username, it is mandatory and must be less then ${maxUsernameLength} characters long.`
      )
    )
  }

  if (game.userList.size > maxPlayers) {
    return left(new Error(`game has ${maxPlayers}, cannot add any more`))
  }

  const randomness = crypto.randomBytes(256).toString("hex")
  const publicId = game.nextId
  // because people can leave the game, we cannot use the current number of players to work out the max id
  game.nextId += 1 //todo: handle this malicously overflowing
  // including publicId because its guaranteed to be unique
  const privateId = `${randomness}-${publicId}`
  game.idMapping.set(privateId, publicId)
  game.userList.set(publicId, { username: username })
  game.positions.set(publicId, [])
  const proposedTargetList = shuffle(Array.from(game.userList.keys()))
  game.chosenSettings.proposedTargetList = proposedTargetList

  addUser(publicId, game)

  logger.log("verbose", "Adding user to game", {
    publicId: publicId,
    gameCode: game.code,
  })

  return right({ privateId: privateId, publicId: publicId })
}

function removePlayer(
  game: Game,
  publicId: number
): Either<runtypes.Failure | Error, undefined> {
  if (game.state != states.NOT_STARTED) {
    return left(new Error("game already started"))
  }

  if (!game.userList.has(publicId)) {
    return left(new Error(`No player with public ID ${publicId}`))
  }

  for (const [privateId, currentPublicId] of game.idMapping.entries()) {
    if (publicId == currentPublicId) {
      game.idMapping.delete(privateId)
      break
    }
  }
  game.userList.delete(publicId)
  game.positions.delete(publicId)
  const proposedTargetList = shuffle(Array.from(game.userList.keys()))
  game.chosenSettings.proposedTargetList = proposedTargetList

  game.listener!.removeUser({
    publicId,
    gameState: gameStateForClient(game),
  })

  return right(undefined)
}

/*
winner can be the winning players publicId, 'time' if the clock ran out, or undefined if game was stopped manually
  */
async function finishGame(
  game: Game,
  nextCode: string,
  winner: string
): Promise<string> {
  game.state = states.FINISHED
  game.subState = undefined
  game.winner = winner
  game.nextCode = nextCode
  return imageStore.uploadGameState(gameStateForClient(game), game.code)
}

function updatePosition(
  game: Game,
  publicId: number,
  position: SharedGame.Position
) {
  if (
    Object.prototype.hasOwnProperty.call(position, "longitude") &&
    Object.prototype.hasOwnProperty.call(position, "latitude") &&
    position.longitude != null &&
    position.latitude != null &&
    game.state == states.IN_PLAY
  ) {
    // we trust client timestamps if they are given
    // on the assumption they are more accurate (no lag)
    // malicious timestamps aren't a concern
    // todo: add some validation to prevent accidentally wrong client timestamps
    // from back client clock etc
    // check timestamp < now and > previous timestamp from client
    if (position.timestamp == undefined) {
      position.timestamp = Date.now()
    }
    logger.log("verbose", "good pos update", {
      gameCode: game.code,
      publicId: publicId,
      position: position,
    })
    game.positions.get(publicId)!.push(position)
  } else {
    logger.log("verbose", "bad position update", {
      gameCode: game.code,
      publicId: publicId,
      position: position,
    })
  }
}

function badSnipe(game: Game, snipeInfosIndex: number, publicId: number) {
  const snipeInfo = game.snipeInfos[snipeInfosIndex]

  if (snipeInfo.undone) {
    return
  }

  // check they haven't already voted
  if (snipeInfo.votes.indexOf(publicId) == -1) {
    snipeInfo.votes.push(publicId)
  } else {
    return
  }

  const voteCount = snipeInfo.votes.length

  if (publicId == snipeInfo.snipePlayer || voteCount > 2) {
    const undoneSnipes = undoSnipe(game, snipeInfo)

    return undoneSnipes
  }
}

// uniqueId should be a value that is never the same between any two games
// it's used so force the attackers to guess a specific game's code individual
// (like a username does in a normal login system)
// Otherwise, if we have X games, with a game code space of Y
// as X becomes a larger fraction of Y, guessing gets easier
// (I think that's the birthday attack)
// 3 words, from 1000 choices, 1 billion combinations
// with a 1000 parallel requests at 0.1 second per request that's
// = search space / (parallelism * requests per second * seconds in minute * minutes in hour * hours in day)
// = 1000**3/(1000*10*60*60) = 27 hours of guessing
// todo: If we ever consider perma-hosting games after they finish
// or allowing very long running games
// consider adding another word - but it starts to look unwieldy
// maybe rate-limit clients instead
// todo: consider curating the list of words to use shorter words
// to save screen width space
export function generateGameCode(uniqueId: number): string {
  const randomWords = []
  for (let wordIndex = 0; wordIndex < 3; wordIndex++) {
    randomWords.push(commonWords[crypto.randomInt(commonWords.length)])
  }

  const uniqueWord = commonWords[uniqueId + 1]

  return randomWords.join("-") + `-${uniqueWord}`
}
function generateGame(listener: (code: string, game: Game) => Listener) {
  // todo: when we're running in prod the number of game is likely to go up as well as down, we should probably use a dedicated counter that loops on overflow or something
  const code = generateGameCode(games.size)
  const game = newGame(code)
  game.listener = listener(code, game)
  logger.log("verbose", "making game", { gameCode: code })
  games.set(game.code, game)

  return game
}

export function getGame(code: string): Game | undefined {
  return games.get(code.toLowerCase())
}

export {
  newGame,
  states,
  start,
  inPlaySubStates,
  snipe,
  gameStateForClient,
  removePlayer,
  finishGame,
  updatePosition,
  badSnipe,
  generateGame,
}
