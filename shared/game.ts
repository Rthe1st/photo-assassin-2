// this is game, but stripped of any info players shouldn't know
// and using types we can send of socketio (no Map)
export interface ClientGame {
  chosenSettings: { gameLength?: number, countDown?: number, proposedTargetList: number[] },
  state: string,
  subState: string | undefined,
  userList: UserList,
  targets: { [key: number]: number[] } | undefined,
  targetsGot: { [key: number]: number[] } | undefined,
  // omitted until game over
  positions?: { [key: number]: any },
  gameLength: number | undefined,
  countDown: number | undefined,
  timeLeft: number | undefined,
  nextCode: string | undefined,
  badSnipeVotes: { [key: number]: any },
  undoneSnipes: UndoneSnipes,
  winner: string | undefined,
  imageMetadata: ImageMetadata
}

export interface UserList {
  [key: number]: any
}

export interface UndoneSnipes {
  [key: number]: any,
  [Symbol.iterator]: any
}

export interface ImageMetadata { [key: number]: { snipeNumber: number, position: Position, targetPosition: Position }[] }

export interface Position {
  longitude: number | null,
  latitude: number | null,
  // todo: move this out, it's only stored this as a hack
  // for retrieving snipe data about an image
  snipeInfo?: {
    target: number,
    targetPosition: any
  }
}
