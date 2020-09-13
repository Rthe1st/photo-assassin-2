import * as SharedGame from '../shared/game'

export interface ServerInitializationMsg {
    gameState: SharedGame.ClientGame,
    chatHistory: ServerChatMessage[]
}

export interface NewUserMsg {
    publicId: number, gameState: SharedGame.ClientGame
}

export interface RemoveUserMsg {
    publicId: number, gameState: SharedGame.ClientGame
}

export interface ServerUndoMakeTargetsMsg { gameState: SharedGame.ClientGame }

export interface ServerMakeTargetsMsg { gameState: SharedGame.ClientGame }

export interface ServerBadSnipeMsg { gameState: SharedGame.ClientGame, undoneSnipeIndexes: number[] }

export interface ServerFinishedMsg { nextCode: string, winner: string }

export interface ServerTimeLeftMsg { gameState: SharedGame.ClientGame }

export interface ServerStartMsg { gameState: SharedGame.ClientGame }

export type SnipeInfo = SharedGame.SnipeInfo

export interface ServerChatMessage {
    publicId: number,
    text: string,
    imageId?: number,
    snipeInfo?: SnipeInfo,
    botMessage?: string,
    gameState: SharedGame.ClientGame
  }

export type ClientPositionUpdate = SharedGame.Position

export interface ClientChatMessage {
    text: string,
    image?: File | ArrayBuffer,
    position?: SharedGame.Position,
    isSnipe?: boolean
}

export interface ClientBadSnipe {
    snipeInfosIndex: number
}

export interface ClientMakeTargets {
    gameLength: number,
    countDown: number,
    proposedTargetList: number[]
}

export interface ClientRemoveUser {
    publicId: number
}

