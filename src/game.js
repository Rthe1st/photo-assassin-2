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

function getTargetPairs(){
    let pairs = [];
    for (var publicId of Object.keys(game.targets)) {
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

export { getUsername, getSettings, update, getTarget, states, timeLeft, inPlaySubStates, game, getTargetPairs}
