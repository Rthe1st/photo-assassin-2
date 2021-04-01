import * as SharedGame from '../shared/game'

export const states = Object.freeze({ "NOT_STARTED": "NOT STARTED", "IN_PLAY": "IN PLAY"})

export const inPlaySubStates = Object.freeze({ COUNTDOWN: "COUNTDOWN", PLAYING: "PLAYING" })

export let game: SharedGame.ClientGame;

export function update(updatedGame: SharedGame.ClientGame){
    game = updatedGame;
}

export function getSettings(){
    return game.chosenSettings;
}

export function getPublicIds(sortByProgress: boolean = false) {
    let players = Object.keys(game.userList).map(x => parseInt(x))
    if(sortByProgress){
        players.sort((a, b) => game.targetsGot![b].length - game.targetsGot![a].length)
    }

    return players
}

export function startTime(): number{
    //todo: this should be stored on the game obj by server
    // instead of trying to work it out
    let earliestTime = Number.POSITIVE_INFINITY;
    for (const playerPublicId of getPublicIds()) {
        let firstPosition = game.positions![playerPublicId][0];
        if(firstPosition != undefined){
            earliestTime = Math.min(earliestTime, firstPosition.timestamp!);
        }
    }
    return earliestTime;
}

export function endTime(): number{
    return startTime() + game.chosenSettings.countDown + game.chosenSettings.gameLength;
}

export function getUsername(publicId: number){
    return game.userList[publicId].username;
}

export function getLastSnipedPlayerId(publicId: number){
    let targetsGot = game.targetsGot![publicId];
    return targetsGot[targetsGot.length - 1];
}

export function getSnipeInfos(publicId: number){
    let snipeInfoIndex = game.latestSnipeIndexes[publicId]
    let snipeInfos = []
    while(snipeInfoIndex != undefined){
        let snipeInfo = game.snipeInfos[snipeInfoIndex]
        snipeInfos.push(snipeInfo)
        snipeInfoIndex = snipeInfo.previousSnipe
    }
    return snipeInfos
}

export function getPlayerProgress(publicId: number){
    let got = game.targetsGot![publicId].length;
    let remaining = got + game.targets![publicId].length;
    return [got, remaining];
}

export function getTarget(publicId: number, snipeNumber?: number){
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

export function timeLeft(){
    //returns in seconds
    if(game.subState == inPlaySubStates.COUNTDOWN){
        return Math.round((game.timeLeft! - game.chosenSettings.gameLength) / 1000);
    }else if(game.subState == inPlaySubStates.PLAYING){
        return Math.round((game.timeLeft!) / 1000);
    }else{
        console.log("error, timeleft called in invalid substate " + game.subState)
    }
}

export function getSnipeImageId(snipeInfoIndex: number ){
    return game.snipeInfos[snipeInfoIndex].imageId
}

export function getImageUrl(imageId: number, lowRes:boolean): string|undefined{
    
    let imageIdArray: (string|undefined)[];

    if(lowRes){
        imageIdArray = game.lowResUploadsDone;
    }else{
        imageIdArray = game.imageUploadsDone;
    }

    if(imageIdArray.length > imageId && imageIdArray[imageId] != undefined){
        return imageIdArray[imageId]
    }
    return undefined
}


export interface UnconfirmedMessage {
    placeHolderMessage: HTMLLIElement
}

export interface ClientOnly {
    unconfirmedMessages: { [id: number]: UnconfirmedMessage }
}

export let clientOnly: ClientOnly = {
    unconfirmedMessages: []
}
