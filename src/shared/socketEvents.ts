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

export interface ServerUpdateSettingsMsg { gameState: SharedGame.ClientGame }

export interface ServerBadSnipeMsg { gameState: SharedGame.ClientGame, undoneSnipeIndexes: number[] }

export interface ServerFinishedMsg { nextCode: string, winner: string }

export interface ServerTimeLeftMsg { gameState: SharedGame.ClientGame }

export interface ServerStartMsg { gameState: SharedGame.ClientGame }

export interface ServerResizeDone {imageId: number, url: string}

export interface ServerImageUploadDone {imageId: number, url: string}

export type SnipeInfo = SharedGame.SnipeInfo

export interface ServerChatMessage {
    publicId: number,
    text: string,
    imageId?: number,
    snipeInfo?: SnipeInfo,
    botMessage?: string,
    //todo: remove this - it massivly explodes size of chathistory
    gameState: SharedGame.ClientGame,
    // a random number to match messages from the server with those sent from the client
    // so we can confirm message X was received
    nonce: number
  }

export type ClientPositionUpdate = SharedGame.Position

export interface ClientChatMessage {
    text: string,
    image?: File | ArrayBuffer,
    position?: SharedGame.Position,
    isSnipe?: boolean,
    nonce: number
}

export interface ClientBadSnipe {
    snipeInfosIndex: number
}

// todo: we could save bandwidth by making most of these optional
// and only sending the one that changed
export interface ClientUpdateSettings {
    gameLength: number,
    countDown: number,
    proposedTargetList: number[]
}

export interface ClientRemoveUser {
    publicId: number
}

