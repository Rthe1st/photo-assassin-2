export interface Settings {
  gameLength: number
  countDown: number
  proposedTargetList: number[]
}

// this is game, but stripped of any info players shouldn't know
// and using types we can send of socketio (no Map)
export interface ClientGame {
  chosenSettings: Settings
  state: string
  subState: string | undefined
  userList: UserList
  targets: { [key: number]: number[] } | undefined
  targetsGot: { [key: number]: number[] } | undefined
  // omitted until game over
  positions?: { [key: number]: Position[] }
  timeLeft: number | undefined
  nextCode: string | undefined
  winner: string | undefined
  snipeInfos: SnipeInfo[]
  latestSnipeIndexes: { [key: number]: number | undefined }
  imageUploadsDone: (string | undefined)[]
  lowResUploadsDone: (string | undefined)[]
}

export interface UserList {
  [key: number]: any
}

export interface UndoneSnipes {
  [key: number]: any
  [Symbol.iterator]: any
}

export interface Position {
  longitude: number | null
  latitude: number | null
  accuracy: number | null
  heading: number | null
  speed: number | null
  timestamp: number | null
  altitude: number | null
  altitudeAccuracy: number | null
  // todo: move this out, it's only stored this as a hack
  // for retrieving snipe data about an image
  snipeInfo?: {
    target: number
    targetPosition: any
  }
}

export interface SnipeInfo {
  // index of this snipe info in game.snipeInfos
  index: number
  snipePlayer: number
  imageId: number
  // todo: can we use a set?
  votes: number[]
  position?: Position
  targetPosition?: Position
  target: number
  previousSnipe: number | undefined
  nextSnipe: number | undefined
  undoneNextSnipes: number[]
  undone: boolean
}
