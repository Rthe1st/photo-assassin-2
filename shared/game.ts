// this is game, but stripped of any info players shouldn't know
// and using types we can send of socketio (no Map)
export interface ClientGame {
    chosenSettings: {gameLength: number, countDown: number, proposedTargetList: number[]},
    state: string,
    subState: string,
    userList: UserList,
    targets: {[key:number]: number[]},
    targetsGot: {[key:number]: number[]},
    positions: {[key: number]: any},
    gameLength: number,
    countDown: number,
    timeLeft: number,
    nextCode: string,
    badSnipeVotes: {[key: number]: any},
    undoneSnipes: UndoneSnipes,
    winner: string,
    imageMetadata: ImageMetadata
}

export interface UserList {
  [key: number]: any
}

export interface UndoneSnipes {
  [key: number]: any,
  [Symbol.iterator]: any
}

export interface ImageMetadata {[key:number]: {snipeNumber: number, position: Position, targetPosition: Position}[]}

export interface Position {
    longitude: number,
    latitude: number
}