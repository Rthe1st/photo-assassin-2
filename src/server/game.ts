import * as crypto from 'crypto';
import { shuffle } from '../shared/shuffle'
import * as SharedGame from '../shared/game'
import * as SocketEvents from '../shared/socketEvents'
import sharp from 'sharp'
import {commonWords} from './commonWords'

import socketIo from 'socket.io'

import { logger } from './logging'

export let games: Map<string, Game> = new Map();

const states = Object.freeze({ "FINISHED": "FINISHED", "NOT_STARTED": "NOT STARTED", "IN_PLAY": "IN PLAY" })

const inPlaySubStates = Object.freeze({ COUNTDOWN: "COUNTDOWN", PLAYING: "PLAYING" })

export interface Game {
  chosenSettings: SharedGame.Settings,
  code: string,
  // todo: make enum
  state: string,
  //substate is used for dividing the in play state in countdown and playing, for example
  subState: string | undefined,
  // this maps the private ID given to a client via a cookie
  // to an ID that is shown to other players
  // if other players learn your private ID, they can impersonate you
  idMapping: Map<string, number>
  nextId: 0,//includes old users - used to get a historically unique id for a user
  userList: Map<number, any>,
  targets: { [key: number]: number[] },
  targetsGot: { [key: number]: number[] },
  positions: Map<number, SharedGame.Position[]>,
  startTime: number | undefined,
  timeLeft: number | undefined,
  nextCode: string | undefined,
  // this is used to look up the current head of a players snipeInfos
  latestSnipeIndexes: { [key: number]: number | undefined }
  snipeInfos: SharedGame.SnipeInfo[],
  winner: string | undefined,
  // this includes images and so will get huge
  // todo: make client smart so it only requests those its missing
  // / saves what its already seen to local storage
  // and consider off loading images to cdn
  // todo: instead of saving images directly in here, we should point
  // to those in the images key
  // (and even that should just be a ref to images stored not in memory)
  chatHistory: SocketEvents.ServerChatMessage[],
  //todo: store these in a database
  actualImages: Buffer[],
  // used to give thumbnail to user
  // (we only expand to full image when they click)
  lowResImages: (Buffer|undefined)[],
  // this is set after the game is created, because we need to know the
  // game code in order to define the namespace
  // used to communicate with the sockets where we don't have easy access to the namespace
  namespace: socketIo.Namespace | undefined,
}

function newGame(code: string): Game {
  return {
    chosenSettings: {
      gameLength: 5 * 60 * 1000,
      countDown: 5 * 60 * 1000,
      proposedTargetList: []
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
    actualImages: [],
    lowResImages: [],
    winner: undefined,
    namespace: undefined
  };

}

export function getActualImage(game: Game, id: number, lowRes = false){
  if(lowRes){
    return game.lowResImages[id]    
  }
  return game.actualImages[id]
}

export function saveImage(game: Game, image: Buffer): {imageId: number, resizePromise: Promise<Buffer>} {

  let imageId = game.actualImages.length

  game.actualImages.push(image);

  // because the resizing is async, reserve our place in the lowRes array
  game.lowResImages.push(undefined)
  let resizePromise = sharp(image)
    .resize(100,100) //todo: choose a better size
    .toBuffer()

  return {imageId: imageId, resizePromise: resizePromise};

}

function updateSettings(game: Game, gameLength: number, countDown: number, proposedTargetList: number[]) {
  // todo: validate
  game.chosenSettings = { gameLength: gameLength, countDown: countDown, proposedTargetList: proposedTargetList };
}

function start(game: Game) {
  game.startTime = Date.now();
  let chosenSettings = game.chosenSettings;
  for (var i = 0; i < game.chosenSettings.proposedTargetList.length; i++) {
    let targetsBeforePlayer = chosenSettings.proposedTargetList.slice(i + 1);
    let targetsAfterPlayer = chosenSettings.proposedTargetList.slice(0, i);
    let player = chosenSettings.proposedTargetList[i]
    game.targets[player] = targetsBeforePlayer.concat(targetsAfterPlayer);
    game.targetsGot[player] = [];
  }
  game.state = states.IN_PLAY;
  if (game.chosenSettings.countDown) {
    game.subState = inPlaySubStates.COUNTDOWN;
  } else {
    game.subState = inPlaySubStates.PLAYING;
  }
}

function snipe(game: Game, sniperPublicId: number, imageId: number, position?: SharedGame.Position): {gameOver: boolean, snipeInfo: SharedGame.SnipeInfo, botMessage: string | undefined} {
  var snipedId = game.targets[sniperPublicId][0];

  let targetPosition = game.positions.get(snipedId)![game.positions.get(snipedId)!.length - 1]

  var usernameWhoDidSniping = game.userList.get(sniperPublicId).username;
  var usernameThatGotSniped = game.userList.get(game.targets[sniperPublicId][0]).username;
  //todo: move botmessage computation to client side
  var botMessage = usernameWhoDidSniping + " sniped " + usernameThatGotSniped;

  var targets = game.targets[sniperPublicId];

  //targets[0] becomes the new target
  game.targetsGot[sniperPublicId].push(targets.shift()!);
  var gameOver = (targets.length == 0);

  let snipeInfo = {
    index: game.snipeInfos.length,
    snipePlayer: sniperPublicId,
    target: snipedId,
    votes: [],
    imageId: imageId!,
    targetPosition: targetPosition,
    position: position,
    previousSnipe: game.latestSnipeIndexes[sniperPublicId],
    nextSnipe: undefined,
    undoneNextSnipes: [],
    undone: false
  }

  game.snipeInfos.push(snipeInfo)

  game.latestSnipeIndexes[sniperPublicId] = snipeInfo.index

  return { gameOver: gameOver, snipeInfo: snipeInfo, botMessage: botMessage};
}

function undoSnipe(game: Game, snipeInfo: SocketEvents.SnipeInfo): number[] {
  
  let undoneSnipeIndexes: number[] = [snipeInfo.index]
  snipeInfo.undone = true
  game.targets[snipeInfo.snipePlayer].unshift(game.targetsGot[snipeInfo.snipePlayer].pop()!);

  let previousSnipeIndex = snipeInfo.previousSnipe
  if(previousSnipeIndex == undefined){
    game.latestSnipeIndexes[snipeInfo.snipePlayer] = undefined
  }else{
    game.latestSnipeIndexes[snipeInfo.snipePlayer] = previousSnipeIndex
    let previousSnipe = game.snipeInfos[previousSnipeIndex]
    previousSnipe.undoneNextSnipes.push(snipeInfo.index)
    previousSnipe.nextSnipe = undefined
  }

  while(snipeInfo.nextSnipe != undefined){
    undoneSnipeIndexes.push(snipeInfo.nextSnipe)
    snipeInfo = game.snipeInfos[snipeInfo.nextSnipe]
    snipeInfo.undone = true
    // note that the target being shifted here
    // is NOT the target of the current snipeInfo
    // we just know that the number of times we shift
    // matches the total number of links we're going to
    // travel forward
    game.targets[snipeInfo.snipePlayer].unshift(game.targetsGot[snipeInfo.snipePlayer].pop()!);
  }

  return undoneSnipeIndexes;
}

function gameStateForClient(game: Game) {
  var state: SharedGame.ClientGame = {
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
    latestSnipeIndexes: game.latestSnipeIndexes
  }

  if (game.state == states.FINISHED) {
    state["positions"] = Object.fromEntries(game.positions.entries());
  }

  return state;

}

// public ID cannot change, username might be changed by user
function addPlayer(game: Game, username: string): { privateId: string, publicId: number } {
  var randomness = crypto.randomBytes(256).toString('hex');
  var publicId = game.nextId;
  // because people can leave the game, we cannot use the current number of players to work out the max id
  game.nextId += 1;//todo: handle this malicously overflowing
  // including publicId because its guaranteed to be unique
  var privateId = `${randomness}-${publicId}`;
  game.idMapping.set(privateId, publicId);
  game.userList.set(publicId, { username: username });
  game.positions.set(publicId, []);
  let proposedTargetList = shuffle(Array.from(game.userList.keys()));
  game.chosenSettings.proposedTargetList = proposedTargetList;
  return { privateId: privateId, publicId: publicId };
}

function removePlayer(game: Game, publicId: number) {
  for (var [privateId, currentPublicId] of game.idMapping.entries()) {
    if (publicId == currentPublicId) {
      game.idMapping.delete(privateId);
      break;
    }
  }
  game.userList.delete(publicId);
  game.positions.delete(publicId);
  let proposedTargetList = shuffle(Array.from(game.userList.keys()));
  game.chosenSettings.proposedTargetList = proposedTargetList;
}

/*
winner can be the winning players publicId, 'time' if the clock ran out, or undefined if game was stopped manually
  */
function finishGame(game: Game, nextCode: string, winner: string) {
  game.state = states.FINISHED;
  game.subState = undefined;
  game.winner = winner;
  game.nextCode = nextCode;
}

function updatePosition(game: Game, publicId: number, position: SharedGame.Position) {
  if (
    position.hasOwnProperty('longitude')
    && position.hasOwnProperty('latitude')
    && position.longitude != null
    && position.latitude != null
    && game.state == states.IN_PLAY
  ) {
    logger.log("verbose", "good pos update", { game: game, publicId: publicId, position: position });
    // so there was no positions entry for one of our players?
    game.positions.get(publicId)!.push(position);
  }else{
    logger.log("verbose", "bad position update", { game: game, publicId: publicId, position: position });
  }
}

function badSnipe(game: Game, snipeInfosIndex: number, publicId: number) {

  let snipeInfo = game.snipeInfos[snipeInfosIndex]

  if(snipeInfo.undone){
    return
  }

  // check they haven't already voted
  if(snipeInfo.votes.indexOf(publicId) == -1){
    snipeInfo.votes.push(publicId)
  }else{
    return
  }

  let voteCount = snipeInfo.votes.length

  if(publicId == snipeInfo.snipePlayer || voteCount > 2){
    let undoneSnipes = undoSnipe(game, snipeInfo);

    return undoneSnipes;

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
function generateGameCode(uniqueId: number): string {
  let randomWords = []
  for(let wordIndex=0; wordIndex<3; wordIndex++){
    randomWords.push(commonWords[crypto.randomInt(commonWords.length)]);
  }

  let uniqueWord = commonWords[(uniqueId + 1)];

  return randomWords.join("-") + `-${uniqueWord}`;
}
function generateGame() {
  // todo: when we're running in prod the number of game is likely to go up as well as down, we should probably use a dedicated counter that loops on overflow or something
  let code = generateGameCode(games.size);
  let game = newGame(code);
  logger.log("verbose", "making game", { gameCode: code });
  games.set(game.code, game);
  return game;
}

export function getGame(code?: string){
  if(code == undefined){
    return undefined
  }
  return games.get(code.toLowerCase());
}

export { newGame, updateSettings, states, start, inPlaySubStates, snipe, gameStateForClient, addPlayer, removePlayer, finishGame, updatePosition, badSnipe, generateGame };