// purpose of this is for testing the server
// and allowing AI opponents
// without the need for a browser

import * as socketEvents from '../src/socketEvents.js';
import fetch from 'node-fetch';
// import { game } from '../src/game.js';
import fs from 'fs';
import * as randomSeed from 'random-seed';

let domain;
if(process.argv.length == 4 && process.argv[3] == "prod"){
    domain = "https://photo-assassin.prangten.com"
}else{
    domain = "http://localhost:3000"
}

function makeGame(username){
    const url = `${domain}/make?username=${username}&format=json`;
    
    const getData = async url => {
        const response = await fetch(url);
        const json = await response.json();
        return json;
    };
    
    return getData(url);
    
}

function joinGame(username, gameId){
    const url = `${domain}/join?code=${gameId}&username=${username}&format=json`;
    
    const getData = async url => {
        const response = await fetch(url);
        const json = await response.json();
        return json;
    };
    
    return getData(url);
}

async function gameSetup(players){
    let hostPlayer = players.shift();
    let details = await makeGame(hostPlayer.name);
    console.log(details);
    console.log(`${domain}/game/${details["gameId"]}`);
    let gameId = details.gameId;
    let sockets = new Map();
    let socket = hostPlayer.algo(details.gameId, details.privateId, hostPlayer);
    sockets.set(details.publicId, socket);
    for(let player of players){
        let details = await joinGame(player.name, gameId);
        let socket = player.algo(details.gameId, details.privateId, player);
        sockets.set(details.publicId, socket);
    }
}

function activePlayer(gameId, privateId, player){
    var randomGenerator = randomSeed.default.create("seedvalue");

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
                "position": {"latitude": player.position.lat, "longitude": player.position.long},
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
            player.position.lat += (Math.random()-0.5)*0.001;
            player.position.long += (Math.random()-0.5)*0.001;
            let file = fs.readFileSync('/home/mehow/Dropbox/Photos/rabbits.jpg');
            let message = {
                "text": "gotya",
                "image": file,
                "position": {"latitude": player.position.lat, "longitude": player.position.long},
                "isSnipe": randomGenerator(100) > 50,
            }
            socketEvents.chatMessage(socket, message);
        },
        domain
    );
    return socket;
}

function passivePlayer(gameId, privateId, player){
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
        (msg)=>{
            console.log('chat message')
            player.position.lat += (Math.random()-0.5)*0.001;
            player.position.long += (Math.random()-0.5)*0.001;
            socketEvents.positionUpdate(socket, {"latitude": player.position.lat, "longitude": player.position.long});
        },
        domain
    );
    return socket;
}

function listeningPlayer(gameId, privateId, player){
    let socket = socketEvents.setup(
        gameId,
        privateId,
        (msg)=>{
            console.log('init');
        },
        ()=>{},
        ()=>{},
        ()=>{},
        (msg)=>{},
        ()=>{},
        (msg)=>{
            console.log('start')
        },
        ()=>{
            console.log("game over");
        },
        ()=>{},
        (msg)=>{
            console.log('chat message');
            player.position.lat += (Math.random()-0.5)*0.001;
            player.position.long += (Math.random()-0.5)*0.001;
            let parts = msg.text.split(" ");
            if(parts.length < 2){
                console.log("bad comand");
                console.log(parts);
                return;
            }
            let command = parts[0];
            let name = parts[1];
            if(name == player.name || name == "all"){
                if(command == "snipe"){
                    let file = fs.readFileSync('/home/mehow/Dropbox/Photos/rabbits.jpg');
                    let message = {
                        "text": "gotya",
                        "image": file,
                        "position": {"latitude": player.position.lat, "longitude": player.position.long},
                        "isSnipe": true,
                    }
                    socketEvents.chatMessage(socket, message);
                }else if(command == "move"){
                    player.position.lat += (Math.random()-0.5)*0.001;
                    player.position.long += (Math.random()-0.5)*0.001;
                    socketEvents.positionUpdate(socket, {"latitude": player.position.lat, "longitude": player.position.long});
                }else if(command == "picture"){
                    let file = fs.readFileSync('/home/mehow/Dropbox/Photos/rabbits.jpg');
                    let message = {
                        "text": "gotya",
                        "image": file,
                        "position": {"latitude": player.position.lat, "longitude": player.position.long},
                        "isSnipe": false,
                    }
                    socketEvents.chatMessage(socket, message);
                }else if(command == "message"){
                    let message = {
                        "text": "blahblah",
                        "position": {"latitude": player.position.lat, "longitude": player.position.long},
                    }
                    socketEvents.chatMessage(socket, message);
                }else if(command == "badsnipe" && parts.length == 4){
                    socketEvents.badSnipe(socket, parts[2], parts[3]);
                }
            }
        },
        domain
    );
    return socket;
}

if(process.argv[2] == "active"){
    gameSetup([
        {
            name:'p1',
            algo: passivePlayer,
            position: {lat: 51.389, long: 0.012}
        },
        {
            name:'p2',
            algo: passivePlayer,
            position: {lat: 51.389, long: 0.012}
        },
        {
            name:'p3',
            algo: passivePlayer,
            position: {lat: 51.389, long: 0.012}
        }, {
            name: 'simpleSloth',
            algo: activePlayer,
            position: {lat: 51.389, long: 0.012}
        }]);    
}else if(process.argv[2] == "passive"){
    gameSetup([
        {
            name:'p1',
            algo: passivePlayer,
            position: {lat: 51.389, long: 0.012}
        },
        {
            name:'p2',
            algo: passivePlayer,
            position: {lat: 51.389, long: 0.012}
        },
        {
            name:'p3',
            algo: passivePlayer,
            position: {lat: 51.389, long: 0.012}
        }, {
            name: 'simpleSloth',
            algo: passivePlayer,
            position: {lat: 51.389, long: 0.012}
        }]);
}else if(process.argv[2] == "listen"){
    gameSetup([
        {
            name:'p1',
            algo: listeningPlayer,
            position: {lat: 51.389, long: 0.012}
        },
        {
            name:'p2',
            algo: listeningPlayer,
            position: {lat: 51.389, long: 0.012}
        },
        {
            name:'p3',
            algo: listeningPlayer,
            position: {lat: 51.389, long: 0.012}
        }, {
            name: 'simpleSloth',
            algo: listeningPlayer,
            position: {lat: 51.389, long: 0.012}
        }]);
}