import * as crypto from 'crypto';
import { shuffle } from '../src/shuffle.js'

import { logger } from './logging.js'

const states = Object.freeze({ "FINISHED": "FINISHED", "NOT_STARTED": "NOT STARTED", "IN_PLAY": "IN PLAY", "TARGETS_MADE": "TARGETS MADE" })

const inPlaySubStates = Object.freeze({ COUNTDOWN: "COUNTDOWN", PLAYING: "PLAYING" })

function newGame(code) {
  return {
    // this is the settings chosen by the users before maketargets
    // useful for settings that are now easy to derive from gamestate
    // list proposed target list
    chosenSettings: {},
    code: code,
    state: states.NOT_STARTED,
    //substate is used for dividing the in play state in countdown and playing, for example
    subState: undefined,
    // this maps the private ID given to a client via a cookie
    // to an ID that is shown to other players
    // if other players learn your private ID, they can impersonate you
    idMapping: new Map(),
    nextId: 0,//includes old users - used to get a historicly unique id for a user
    userList: new Map(),
    targets: {},
    targetsGot: {},
    positions: new Map(),
    startTime: undefined,
    gameLength: undefined,
    countDown: undefined,
    timeLeft: undefined,
    nextCode: undefined,
    badSnipeVotes: new Map(),
    undoneSnipes: new Map(),
    // this includes images and so will get huge
    // todo: make client smart so it only requests those its missing
    // / saves what its already seen to local storage
    // and consider off loading images to cdn
    chatHistory: [],
  };

}

function saveSettings(game, gameLength, countDown, proposedTargetList){
  // todo: return errors if invalid options are supplied
  // for now - choose sensible values because its easy
  if (!isNaN(parseInt(gameLength))) {
    game.chosenSettings.gameLength = parseInt(gameLength) * 1000;
  } else {
    game.chosenSettings.gameLength = 1000 * 60 * 5; // 5 min game by default
  }
  if (!isNaN(parseInt(countDown))) {
    game.chosenSettings.countDown = parseInt(countDown) * 1000;
  } else {
    game.chosenSettings.countDown = 1000 * 60;// 1 min countdown by default
  }
  //todo: validate
  game.chosenSettings.proposedTargetList = proposedTargetList;
}

function makeTargets(game, gameLength, countDown, proposedTargetList) {
  saveSettings(game, gameLength, countDown, proposedTargetList);
  game.gameLength = game.chosenSettings.gameLength;
  game.countDown = game.chosenSettings.countDown;
  for (var i = 0; i < proposedTargetList.length; i++) {
    game.targets[proposedTargetList[i]] = proposedTargetList.slice(i + 1).concat(proposedTargetList.slice(0, i));
    game.targetsGot[proposedTargetList[i]] = [];
  }
  game.state = states.TARGETS_MADE;
}

function undoMakeTargets(game) {
  game.gameLength = undefined;
  game.countDown = undefined;
  game.targets = {};
  game.targetsGot = {};
  game.state = states.NOT_STARTED;
}

function start(game) {
  game.startTime = Date.now();
  game.state = states.IN_PLAY;
  if (game.countDown) {
    game.subState = inPlaySubStates.COUNTDOWN;
  } else {
    game.subState = inPlaySubStates.PLAYING;
  }
}

function snipe(game, sniperId) {
  var snipedId = game.targets[sniperId][0];

  var snipeInfo = { "target": snipedId, "targetPosition": game.positions.get(snipedId)[game.positions.get(snipedId).length - 1] };
  var usernameWhoDidSniping = game.userList.get(sniperId).username;
  var usernameThatGotSniped = game.userList.get(game.targets[sniperId][0]).username;
  var botMessage = usernameWhoDidSniping + " sniped " + usernameThatGotSniped;

  //todo: let people vote on wether this is a valid snipe
  var targets = game.targets[sniperId];
  var snipeNumber = targets.length;
  //targets[0] becomes the new target
  game.badSnipeVotes.get(sniperId).set(snipeNumber, 0);
  game.targetsGot[sniperId].push(targets.shift());
  var gameOver = (targets.length == 0);

  var snipeCount;
  if (game.undoneSnipes.has(sniperId) && game.undoneSnipes.get(sniperId).has(snipeNumber)) {
    snipeCount = game.undoneSnipes.get(sniperId).get(snipeNumber) + 1;
  } else {
    snipeCount = 1;
  }

  return { gameOver: gameOver, snipeNumber: snipeNumber, snipeInfo: snipeInfo, botMessage: botMessage, snipeCount };
}

function undoSnipe(game, sniperId, snipeNumber) {
  game.badSnipeVotes.get(sniperId).delete(snipeNumber);
  // snipe number is index of the target list the snipe was for
  // at the start of the game
  // so push @got@ targets back onto the target list until it's snipeNumber+1 long
  var undoneSnipes = []
  while (game.targets[sniperId].length < snipeNumber) {
    game.badSnipeVotes.get(sniperId).delete(game.targets[sniperId].length);
    game.targets[sniperId].unshift(game.targetsGot[sniperId].pop());
    undoneSnipes.push(game.targets[sniperId].length);
  }
  return undoneSnipes;
}

function undoneSnipesForClient(undoneSnipes) {
  var list = [];
  for (var [player, value] of undoneSnipes.entries()) {
    for (var [snipeNumber, count] of value.entries()) {
      list.push(`${player}-${snipeNumber}-${count}`);
    }
  }
  return list;
}

function gameStateForClient(game) {
  var state = {
    chosenSettings: game.chosenSettings,
    userList: Object.fromEntries(game.userList),
    targets: game.targets,
    targetsGot: game.targetsGot,
    gameLength: game.gameLength,
    countDown: game.countDown,
    timeLeft: game.timeLeft,
    state: game.state,
    subState: game.subState,
    winner: game.winner,
    nextCode: game.nextCode,
    badSnipeVotes: Object.fromEntries(game.badSnipeVotes),
    undoneSnipes: undoneSnipesForClient(game.undoneSnipes),//todo: store this in chat history alongside the message
    //we don't include chathistory here
    // because it could be large and is wasteful to
    // send often
  }

  if (game.state == states.FINISHED) {
    state["positions"] = Object.fromEntries(game.positions.entries());
  }

  return state;

}

// public ID cannot change, username might be changed by user
function addPlayer(game, username) {
  var randomness = crypto.randomBytes(256).toString('hex');
  var publicId = game.nextId.toString();
  // because people can leave the game, we cannot use the current number of players to work out the max id
  game.nextId += 1;//todo: handle this malicously overflowing
  // including publicId because its guaranteed to be unique
  var privateId = `${randomness}-${publicId}`;
  game.idMapping.set(privateId, publicId);
  game.userList.set(publicId, { username: username });
  game.positions.set(publicId, []);
  game.badSnipeVotes.set(publicId, new Map());
  let proposedTargetList = shuffle(Array.from(game.userList.keys()));
  saveSettings(game, undefined, undefined, proposedTargetList);
  return [privateId, publicId];
}

function removePlayer(game, publicId) {
  for (var [privateId, currentPublicId] of game.idMapping.entries()) {
    if (publicId == currentPublicId) {
      game.idMapping.delete(privateId);
      break;
    }
  }
  game.userList.delete(publicId);
  game.positions.delete(publicId);
  let proposedTargetList = shuffle(Array.from(game.userList.keys()));
  saveSettings(game, undefined, undefined, proposedTargetList);
}

/*
winner can be the winning players publicId, 'time' if the clock ran out, or undefined if game was stopped manually
  */
function finishGame(game, nextCode, winner) {
  game.state = states.FINISHED;
  game.subState = undefined;
  game.winner = winner;
  game.nextCode = nextCode;
}

function updatePosition(game, publicId, position) {
  if (
    position.hasOwnProperty('longitude')
    && position.hasOwnProperty('latitude')
    && position.longitude != null
    && position.latitude != null
    && game.state == states.IN_PLAY
  ) {
    game.positions.get(publicId).push(position);
  }
}

function badSnipe(game, snipePlayer, snipeNumber, publicId) {
  var playerSnipeVotes = game.badSnipeVotes.get(snipePlayer);
  if (!playerSnipeVotes.has(snipeNumber)) {
    return;
  }
  var voteCount = game.badSnipeVotes.get(snipePlayer).get(snipeNumber);
  if (publicId != snipePlayer) {
    voteCount += 1;
    playerSnipeVotes.set(snipeNumber, voteCount);
  }
  if (publicId == snipePlayer || voteCount >= 2) {
    var undoneSnipes = undoSnipe(game, snipePlayer, snipeNumber);
    //below helps track how many times a single [player, snipenumber] has been undone
    // so client side can work out all the images to mark as undone
    // it's a hack to get around chat history not storing this info
    if (!game.undoneSnipes.has(snipePlayer)) {
      game.undoneSnipes.set(snipePlayer, new Map());
    }
    if (!game.undoneSnipes.get(snipePlayer).has(snipeNumber)) {
      game.undoneSnipes.get(snipePlayer).set(snipeNumber, 1);
    } else {
      game.undoneSnipes.get(snipePlayer).set(snipeNumber, game.undoneSnipes.get(snipePlayer).get(snipeNumber) + 1);
    }

    return undoneSnipes;
  }
  return;
}

function generateGame(games){
  var first_part = crypto.randomBytes(2).toString('hex');
  var second_part = crypto.randomBytes(2).toString('hex');
  // used number of games as a guarantee prevent collisions
  // (even though collisions must be unlikely anyway for the code to provide security)
  var third_part = (games.size + 1).toString(16);
  const code = `${first_part}-${second_part}-${third_part}`;
  games.set(code, newGame(code));
  logger.log("verbose", "making game", {gameCode: code});
  return code;
}

export { newGame, makeTargets, states, undoMakeTargets, start, inPlaySubStates, snipe, gameStateForClient, addPlayer, removePlayer, finishGame, updatePosition, badSnipe, generateGame };