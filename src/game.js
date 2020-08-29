const states = Object.freeze({ "NOT_STARTED": "NOT STARTED", "IN_PLAY": "IN PLAY", "TARGETS_MADE": "TARGETS MADE" })

const inPlaySubStates = Object.freeze({ COUNTDOWN: "COUNTDOWN", PLAYING: "PLAYING" })

let game;

function update(updatedGame){
    game = updatedGame;
}

function getSettings(){
    return game.chosenSettings;
}

function getUsername(publicId){
    return game.userList[publicId].username;
}

export function getLastSnipedPlayerId(publicId){
    let targetsGot = game.targetsGot[publicId];
    return targetsGot[targetsGot.length - 1];
}

function getPlayerProgress(publicId){
    let got = game.targetsGot[publicId].length;
    let remaining = got + game.targets[publicId].length;
    return [got, remaining];
}

function targetDisplay(targets) {
    users = Object.keys(targets);
    output = "";
    for (var i = 0; i < users.length; i++) {
        output += users[i] + "-> " + targets[users[i]] + "\n";
    }
    return output
}

function getTarget(publicId){
    return getUsername(game.targets[publicId][0])
}

export function getProposedTargetPairs(proposedTargetList){
    let pairs = [];
    for (var i=0; i<proposedTargetList.length; i++) {
        let sniper = parseInt(proposedTargetList[i]);
        let target = parseInt(proposedTargetList[(i+1)%proposedTargetList.length]);
        pairs.push([
            getUsername(sniper),
            getUsername(target)
        ]);
    }
    return pairs;
}

function getTargetPairs(){
    let pairs = [];
    for (var publicId of Object.keys(game.targets).sort()) {
        pairs.push([getUsername(publicId), getTarget(publicId)]);
    }
    return pairs;
}

function timeLeft(){
    //returns in seconds
    if(game.subState == inPlaySubStates.COUNTDOWN){
        return (game.timeLeft - game.gameLength) / 1000;
    }else if(game.subState == inPlaySubStates.PLAYING){
        return (game.timeLeft) / 1000;
    }else{
        console.log("error, timeleft called in invalid substate " + game.subState)
    }
}

export { getUsername, getSettings, update, getTarget, states, timeLeft, inPlaySubStates, game, getTargetPairs, getPlayerProgress}
