import * as SharedGame from '../shared/game'

const states = Object.freeze({ "NOT_STARTED": "NOT STARTED", "IN_PLAY": "IN PLAY", "TARGETS_MADE": "TARGETS MADE" })

const inPlaySubStates = Object.freeze({ COUNTDOWN: "COUNTDOWN", PLAYING: "PLAYING" })

let game: SharedGame.ClientGame;

function update(updatedGame: SharedGame.ClientGame){
    game = updatedGame;
}

function getSettings(){
    return game.chosenSettings;
}

function getUsername(publicId: number){
    return game.userList[publicId].username;
}

export function getLastSnipedPlayerId(publicId: number){
    let targetsGot = game.targetsGot![publicId];
    return targetsGot[targetsGot.length - 1];
}

function getPlayerProgress(publicId: number){
    let got = game.targetsGot![publicId].length;
    let remaining = got + game.targets![publicId].length;
    return [got, remaining];
}

function getTarget(publicId: number, snipeNumber?: number){
    if(snipeNumber == undefined){
        snipeNumber = game.targets![publicId].length;
    }
    let totalTargets = game.targetsGot![publicId].concat(game.targets![publicId])
    return getUsername(totalTargets[totalTargets.length - snipeNumber])
}

// this takes proposedTargetList as a param instead of pulling it from game
// for when a player reshuffles locally
// because we want the game object to accurately reflect the server's view of the state
// (so don't save the local reshuffle to the game)
export function getProposedTargetPairs(proposedTargetList: number[]){
    let pairs = [];
    for (var i=0; i<proposedTargetList.length; i++) {
        let sniper = proposedTargetList[i];
        let target = proposedTargetList[(i+1)%proposedTargetList.length];
        pairs.push([
            getUsername(sniper),
            getUsername(target)
        ]);
    }
    return pairs;
}

function timeLeft(){
    //returns in seconds
    if(game.subState == inPlaySubStates.COUNTDOWN){
        return (game.timeLeft! - game.gameLength!) / 1000;
    }else if(game.subState == inPlaySubStates.PLAYING){
        return (game.timeLeft!) / 1000;
    }else{
        console.log("error, timeleft called in invalid substate " + game.subState)
    }
}

export { getUsername, getSettings, update, getTarget, states, timeLeft, inPlaySubStates, game, getPlayerProgress}