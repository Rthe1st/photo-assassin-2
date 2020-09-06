// purpose of this is for testing the server
// and allowing AI opponents
// without the need for a browser

import * as socketEvents from '../src/socketEvents.js';
import fetch from 'node-fetch';
import fs from 'fs';
import * as randomSeed from 'random-seed';

let domain = "http://localhost:3000";

export function useProd(){
    domain = "https://photo-assassin.prangten.com";
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
    let socket = hostPlayer.algo(details.gameId, details.privateId, hostPlayer, details.publicId);
    sockets.set(details.publicId, socket);
    for(let player of players){
        let details = await joinGame(player.name, gameId);
        let socket = player.algo(details.gameId, details.privateId, player, details.publicId);
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
                socketEvents.makeTargets(socket, 60000, 0, msg.gameState.chosenSettings.proposedTargetList);
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
            let file = fs.readFileSync('./server/sample_snipe_image.jpeg');
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
            player.position.lat += (Math.random()-0.5)*0.001;
            player.position.long += (Math.random()-0.5)*0.001;
            let file = fs.readFileSync('./server/sample_snipe_image.jpeg');
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
            player.position.lat += (Math.random()-0.5)*0.001;
            player.position.long += (Math.random()-0.5)*0.001;
            socketEvents.positionUpdate(socket, {"latitude": player.position.lat, "longitude": player.position.long});
        },
        domain
    );
    return socket;
}

function listeningPlayer(gameId, privateId, player, publicId){

    //this is incase we re-connect and miss messages
    let commandsSeen = 0;

    function processCommand(msg){
        player.position.lat += (Math.random()-0.5)*0.001;
        player.position.long += (Math.random()-0.5)*0.001;
        let parts = msg.text.split(" ");
        let command = parts[0];
        let name = parts[1];
        if(name == player.name || name == "all"){
            console.log(command);
            console.log(name);
            if(command == "snipe"){
                console.log("sniping");
                let file = fs.readFileSync('./server/sample_snipe_image.jpeg');
                let message = {
                    "text": "gotya",
                    "image": file,
                    "position": {"latitude": player.position.lat, "longitude": player.position.long},
                    "isSnipe": true,
                }
                socketEvents.chatMessage(socket, message);
            }else if(command == "move"){
                console.log("moving");
                player.position.lat += (Math.random()-0.5)*0.001;
                player.position.long += (Math.random()-0.5)*0.001;
                socketEvents.positionUpdate(socket, {"latitude": player.position.lat, "longitude": player.position.long});
            }else if(command == "picture"){
                console.log("pictureing");
                let file = fs.readFileSync('./server/sample_snipe_image.jpeg');
                let message = {
                    "text": "gotya",
                    "image": file,
                    "position": {"latitude": player.position.lat, "longitude": player.position.long},
                    "isSnipe": false,
                }
                socketEvents.chatMessage(socket, message);
            }else if(command == "message"){
                console.log("messging");
                let message = {
                    "text": "blahblah",
                    "position": {"latitude": player.position.lat, "longitude": player.position.long},
                }
                socketEvents.chatMessage(socket, message);
            }else if(command == "badsnipe" && parts.length == 4){
                console.log("badsniping");
                socketEvents.badSnipe(socket, parts[2], parts[3]);
            }
            // it's important this is only logged after we know the action was sent
            commandsSeen += 1;
        }
    }

    let socket = socketEvents.setup(
        gameId,
        privateId,
        (msg)=>{
            console.log('init:');
            console.log(player);
            let commandsInHistory = 0;
            for(let message of msg.chatHistory){
                let parts = message.text.split(" ");
                if(parts.length < 2){
                    continue;
                }
                let name = parts[1];
                if(name == player.name || name == "all"){
                    commandsInHistory += 1;
                    if(commandsInHistory > commandsSeen){
                        console.log("replaying");
                        console.log(message.text)
                        commandsSeen += 1;
                        processCommand(message);
                    }
                }
            }
        },
        ()=>{},
        ()=>{},
        (msg)=>{
            //remove user
            if(msg.publicId == publicId){
                socket.close();
            }
        },
        (msg)=>{},
        ()=>{},
        (msg)=>{
            console.log('start')
            console.log("start move");
            player.position.lat += (Math.random()-0.5)*0.001;
            player.position.long += (Math.random()-0.5)*0.001;
            socketEvents.positionUpdate(socket, {"latitude": player.position.lat, "longitude": player.position.long});
        },
        ()=>{
            console.log("game over");
        },
        ()=>{},
        processCommand,
        domain
    );
    return socket;
}

export function activeGame(){
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
}

export function passiveGame(){
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
}

export function listenGame(){
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
