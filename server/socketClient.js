// purpose of this is for testing the server
// and allowing AI opponents
// without the need for a browser

import * as socketEvents from '../src/socketEvents.js';
import fetch from 'node-fetch';
// import { game } from '../src/game.js';
import fs from 'fs';

function makeGame(username){
    const url = `http://localhost:3000/make?username=${username}&format=json`;
    
    const getData = async url => {
        const response = await fetch(url);
        const json = await response.json();
        return json;
    };
    
    return getData(url);
    
}

function joinGame(username, gameId){
    const url = `http://localhost:3000/join?code=${gameId}&username=${username}&format=json`;
    
    const getData = async url => {
        const response = await fetch(url);
        const json = await response.json();
        return json;
    };
    
    return getData(url);
}

async function gameSetup(usernames, behaviours){
    let details = await makeGame(usernames.shift());
    let gameId = details.gameId;
    let sockets = new Map();
    let socket = behaviours.shift()(details.gameId, details.privateId);
    sockets.set(details.publicId, socket);
    for(let username of usernames){
        let details = await joinGame(username, gameId);
        let socket = behaviours.shift()(details.gameId, details.privateId);
        sockets.set(details.publicId, socket);
    }
}

const hostname = 'http://localhost:3000'

function activePlayer(gameId, privateId){
    let socket = socketEvents.setup(
        gameId,
        privateId,
        (msg)=>{
            console.log('init');
            if(Object.entries(msg.gameState.userList).length > 1){
                socketEvents.makeTargets(socket, 60, 0);
            }
        },
        ()=>{},
        ()=>{},
        ()=>{},
        (msg)=>{
            console.log('make targets')
            socketEvents.startGame(socket);
        },
        ()=>{},
        (msg)=>{
            console.log('start')
            let file = fs.readFileSync('/home/mehow/Dropbox/Photos/rabbits.jpg');
            let message = {
                "text": "gotya",
                "image": file,
                "position": {"lattitude": 1, "longitude": 1},
                "isSnipe": true,
            }
            socketEvents.chatMessage(socket, message);
        },
        ()=>{
            console.log("game over");
        },
        ()=>{},
        (msg)=>{
            console.log('chat message')
            let file = fs.readFileSync('/home/mehow/Dropbox/Photos/rabbits.jpg');
            let message = {
                "text": "gotya",
                "image": file,
                "position": {"lattitude": 1, "longitude": 1},
                "isSnipe": true,
            }
            socketEvents.chatMessage(socket, message);
        },
        hostname
    );
    return socket;
}

function passivePlayer(gameId, privateId){
    let socket = socketEvents.setup(
        gameId,
        privateId,
        ()=>{},
        ()=>{},
        ()=>{},
        ()=>{},
        ()=>{},
        ()=>{},
        ()=>{},
        ()=>{},
        ()=>{},
        ()=>{},
        hostname
    );
    return socket;
}

gameSetup(['mehow', 'simpleSloth'], [passivePlayer, activePlayer]);
