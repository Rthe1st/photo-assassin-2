// purpose of this is for testing the server
// and allowing AI opponents
// without the need for a browser

import * as socketClient from '../shared/socketClient';
import fetch from 'node-fetch';
import fs from 'fs';
import randomSeed from 'random-seed';
import * as SharedGame from '../shared/game';
import * as https from 'https';

let domain:string = "https://localhost:3000";

export function useProd() {
    domain = "https://photo-assassin.prangten.com";
}

const agent = new https.Agent({
    rejectUnauthorized: false
})

export async function getData(url: string) {
    const response = await fetch(url, {agent});
    const json = await response.json();
    return json;
};


export async function makeGame(username: string, host:string=domain) {
    const url = `${host}/make`;

    let requestOptions = {method: "POST", agent: agent, body: `username=${username}&format=json`, headers:{ 'Content-Type': 'application/x-www-form-urlencoded' }};

    return (await fetch(url, requestOptions)).json();

}

export function joinGame(username: string, gameId: string, host:string=domain) {
    const url = `${host}/join?code=${gameId}&username=${username}&format=json`;

    return getData(url);
}

interface Player {
    name: string;
    algo: (gameId: string, privateId: string, player: Player, publicId: number) => SocketIOClient.Socket;
    position: SharedGame.Position;
}

async function gameSetup(players: Player[], gameId: string|undefined) {
    if (players.length == 0) {
        console.log("no players supplied")
        return;
    }
    let hostPlayer: Player | undefined;
    let details;

    let wasGamePremade = gameId != undefined
    if(!wasGamePremade){
        hostPlayer = players.shift()!;
        details = await makeGame(hostPlayer.name);
        gameId = details.gameId;
    }
    let sockets = new Map();
    for (let player of players) {
        let details = await joinGame(player.name, gameId!);
        let socket = player.algo(details.gameId, details.privateId, player, details.publicId);
        sockets.set(details.publicId, socket);
    }
    if(!wasGamePremade){
        let socket = hostPlayer!.algo(details.gameId, details.privateId, hostPlayer!, details.publicId);
        sockets.set(details.publicId, socket);
    }
}

function activePlayer(gameId: string, privateId: string, player: Player) {
    var randomGenerator = randomSeed.create("seedvalue");

    let socket = socketClient.setup(
        gameId,
        privateId,
        (msg) => {
            console.log('init');
            if (Object.entries(msg.gameState.userList).length > 1) {
                socketClient.startGame(socket, { gameLength: 60000, countDown: 0, proposedTargetList: msg.gameState.chosenSettings.proposedTargetList });
            }
        },
        () => { },
        () => { },
        (_) => { },
        () => { },
        (_) => {
            console.log('start')
            let file = fs.readFileSync('./src/server/sample_snipe_image.jpeg');
            let message = {
                "text": "gotya",
                "image": file,
                "position": {
                    longitude: player.position.longitude,
                    latitude: player.position.latitude,
                    //todo: mock these more correctly
                    accuracy: 1,
                    heading: 0,
                    speed: 1,
                    timestamp: Date.now(),
                    altitude: 0,
                    altitudeAccuracy: 1
                },
                "isSnipe": true,
                //we don't care about this
                nonce: 1
            }
            socketClient.chatMessage(socket, message);
        },
        () => {
            console.log("game over");
        },
        () => { },
        (_) => {
            player.position.latitude! += (Math.random() - 0.5) * 0.001;
            player.position.longitude! += (Math.random() - 0.5) * 0.001;
            let file = fs.readFileSync('./src/server/sample_snipe_image.jpeg');
            let message = {
                "text": "gotya",
                "image": file,
                "position": {
                    longitude: player.position.longitude,
                    latitude: player.position.latitude,
                    accuracy: null,
                    heading: null,
                    speed: null,
                    timestamp: null,
                    altitude: null,
                    altitudeAccuracy: null
                },
                "isSnipe": randomGenerator(100) > 50,
                //we don't care about this
                nonce: 1
            }
            socketClient.chatMessage(socket, message);
        },
        () => {},
        domain
    );
    return socket;
}

function passivePlayer(gameId: string, privateId: string, player: Player) {
    let socket = socketClient.setup(
        gameId,
        privateId,
        () => { console.log("passive init") },
        () => { },
        () => { },
        () => { },
        () => { },
        () => { },
        () => { },
        () => { },
        (_) => {
            player.position.latitude! += (Math.random() - 0.5) * 0.001;
            player.position.longitude! += (Math.random() - 0.5) * 0.001;
            socketClient.positionUpdate(socket, {
                longitude: player.position.longitude,
                latitude: player.position.latitude,
                accuracy: null,
                heading: null,
                speed: null,
                timestamp: null,
                altitude: null,
                altitudeAccuracy: null
            });
        },
        () => {},
        domain
    );
    return socket;
}

function listeningPlayer(gameId: string, privateId: string, player: Player, publicId: number) {

    //this is incase we re-connect and miss messagesfile
    let commandsSeen = 0;

    function processCommand(msg: any) {
        player.position.latitude! += (Math.random() - 0.5) * 0.001;
        player.position.longitude! += (Math.random() - 0.5) * 0.001;
        let parts = msg.text.split(" ");
        let command = parts[0];
        let name = parts[1];
        if (name == player.name || name == "all") {
            console.log(command);
            console.log(name);
            if (command == "snipe") {
                console.log("sniping");
                let file = fs.readFileSync('./src/server/sample_snipe_image.jpeg');
                let message = {
                    "text": "gotya",
                    "image": file,
                    "position": {
                        longitude: player.position.longitude,
                        latitude: player.position.latitude,
                        accuracy: null,
                        heading: null,
                        speed: null,
                        timestamp: null,
                        altitude: null,
                        altitudeAccuracy: null
                    },
                    "isSnipe": true,
                    //we don't care about this
                    nonce: 1
                }
                socketClient.chatMessage(socket, message);
            } else if (command == "move") {
                console.log("moving");
                player.position.latitude! += (Math.random() - 0.5) * 0.001;
                player.position.longitude! += (Math.random() - 0.5) * 0.001;
                socketClient.positionUpdate(socket, {
                    longitude: player.position.longitude,
                    latitude: player.position.latitude,
                    accuracy: null,
                    heading: null,
                    speed: null,
                    timestamp: null,
                    altitude: null,
                    altitudeAccuracy: null
                });
            } else if (command == "picture") {
                console.log("pictureing");
                let file = fs.readFileSync('./src/server/sample_snipe_image.jpeg');
                let message = {
                    "text": "picture",
                    "image": file,
                    "position": {
                        longitude: player.position.longitude,
                        latitude: player.position.latitude,
                        accuracy: null,
                        heading: null,
                        speed: null,
                        timestamp: null,
                        altitude: null,
                        altitudeAccuracy: null
                    },
                    "isSnipe": false,
                    //we don't care about this
                    nonce: 1
                }
                socketClient.chatMessage(socket, message);
            } else if (command == "message") {
                console.log("messging");
                let message: socketClient.ClientChatMessage = {
                    text: "blahblah",
                    position: {
                        longitude: player.position.longitude,
                        latitude: player.position.latitude,
                        accuracy: null,
                        heading: null,
                        speed: null,
                        timestamp: null,
                        altitude: null,
                        altitudeAccuracy: null
                    },
                    image: undefined,
                    isSnipe: undefined,
                    //we don't care about this
                    nonce: 1
                }
                socketClient.chatMessage(socket, message);
            } else if (command == "badsnipe" && parts.length == 3) {
                console.log("badsniping");
                let msg: socketClient.ClientBadSnipe = {
                    snipeInfosIndex: parts[2]
                }
                socketClient.badSnipe(socket, msg);
            }
            // it's important this is only logged after we know the action was sent
            commandsSeen += 1;
        }
    }

    let socket = socketClient.setup(
        gameId,
        privateId,
        (msg) => {
            console.log('init:');
            console.log(player);
            let commandsInHistory = 0;
            for (let message of msg.chatHistory) {
                let parts = message.text.split(" ");
                if (parts.length < 2) {
                    continue;
                }
                let name = parts[1];
                if (name == player.name || name == "all") {
                    commandsInHistory += 1;
                    if (commandsInHistory > commandsSeen) {
                        console.log("replaying");
                        console.log(message.text)
                        commandsSeen += 1;
                        processCommand(message);
                    }
                }
            }
        },
        () => { },
        (msg) => {
            //remove user
            if (msg.publicId == publicId) {
                socket.close();
            }
        },
        (_) => { },
        () => { },
        (_) => {
            console.log('start')
            console.log("start move");
            player.position.latitude! += (Math.random() - 0.5) * 0.001;
            player.position.longitude! += (Math.random() - 0.5) * 0.001;
            socketClient.positionUpdate(socket, {
                longitude: player.position.longitude,
                latitude: player.position.latitude,
                accuracy: null,
                heading: null,
                speed: null,
                timestamp: null,
                altitude: null,
                altitudeAccuracy: null
            });
        },
        () => {
            console.log("game over");
        },
        () => { },
        processCommand,
        () => {},
        domain
    );
    return socket;
}

export async function activeGame() {
    await gameSetup([
        {
            name: 'simpleSloth',
            algo: activePlayer,
            position: {
                longitude: 0.012,
                latitude: 51.389,
                accuracy: null,
                heading: null,
                speed: null,
                timestamp: null,
                altitude: null,
                altitudeAccuracy: null
            },
        },
        {
            name: 'p1',
            algo: passivePlayer,
            position: {
                longitude: 0.012,
                latitude: 51.389,
                accuracy: null,
                heading: null,
                speed: null,
                timestamp: null,
                altitude: null,
                altitudeAccuracy: null
            },
        },
        {
            name: 'p2',
            algo: passivePlayer,
            position: {
                longitude: 0.012,
                latitude: 51.389,
                accuracy: null,
                heading: null,
                speed: null,
                timestamp: null,
                altitude: null,
                altitudeAccuracy: null
            },
        },
        {
            name: 'p3',
            algo: passivePlayer,
            position: {
                longitude: 0.012,
                latitude: 51.389,
                accuracy: null,
                heading: null,
                speed: null,
                timestamp: null,
                altitude: null,
                altitudeAccuracy: null
            },
        }],
        undefined);
}

export function passiveGame(gameCode?: string) {
    gameSetup([
        {
            name: 'p1',
            algo: passivePlayer,
            position: {
                longitude: 0.012,
                latitude: 51.389,
                accuracy: null,
                heading: null,
                speed: null,
                timestamp: null,
                altitude: null,
                altitudeAccuracy: null
            },
        },
        {
            name: 'p2',
            algo: passivePlayer,
            position: {
                longitude: 0.012,
                latitude: 51.389,
                accuracy: null,
                heading: null,
                speed: null,
                timestamp: null,
                altitude: null,
                altitudeAccuracy: null
            },
        },
        {
            name: 'p3',
            algo: passivePlayer,
            position: {
                longitude: 0.012,
                latitude: 51.389,
                accuracy: null,
                heading: null,
                speed: null,
                timestamp: null,
                altitude: null,
                altitudeAccuracy: null
            },
        }, {
            name: 'simpleSloth',
            algo: passivePlayer,
            position: {
                longitude: 0.012,
                latitude: 51.389,
                accuracy: null,
                heading: null,
                speed: null,
                timestamp: null,
                altitude: null,
                altitudeAccuracy: null
            },
        }],
        gameCode);
}

export function listenGame(gameCode?: string) {
    gameSetup([
        {
            name: 'p1',
            algo: listeningPlayer,
            position: {
                longitude: 0.012,
                latitude: 51.389,
                accuracy: null,
                heading: null,
                speed: null,
                timestamp: null,
                altitude: null,
                altitudeAccuracy: null
            },
        },
        {
            name: 'p2',
            algo: listeningPlayer,
            position: {
                longitude: 0.012,
                latitude: 51.389,
                accuracy: null,
                heading: null,
                speed: null,
                timestamp: null,
                altitude: null,
                altitudeAccuracy: null
            },
        },
        {
            name: 'p3',
            algo: listeningPlayer,
            position: {
                longitude: 0.012,
                latitude: 51.389,
                accuracy: null,
                heading: null,
                speed: null,
                timestamp: null,
                altitude: null,
                altitudeAccuracy: null
            },
        }, {
            name: 'simpleSloth',
            algo: listeningPlayer,
            position: {
                longitude: 0.012,
                latitude: 51.389,
                accuracy: null,
                heading: null,
                speed: null,
                timestamp: null,
                altitude: null,
                altitudeAccuracy: null
            },
        }],
        gameCode);
}

function gpsPlayer(gameId: string, privateId: string, _: Player) {
    let socket = socketClient.setup(
        gameId,
        privateId,
        (msg) => {
            console.log("init, starting")
            var gpsData = JSON.parse(fs.readFileSync('./src/server/gps_test_data.json', 'utf8'));
            let gameLength = gpsData[gpsData.length-1]["timestamp"] - gpsData[0]["timestamp"];
            socketClient.startGame(socket, { gameLength: gameLength, countDown: 0, proposedTargetList: msg.gameState.chosenSettings.proposedTargetList });
        },
        () => { },
        () => { },
        () => { },
        () => { },
        (_) => {
            console.log("started")
            var gpsData = JSON.parse(fs.readFileSync('gps_test_data.json', 'utf8'));
            for(let position of gpsData){
                socketClient.positionUpdate(socket, position);
            }
            socketClient.stopGame(socket);
        },
        () => { },
        () => { },
        () => { },
        () => {},
        domain
    );
    return socket;
}


export function gpsGame(gameCode?: string) {
    gameSetup([
        {
            name: 'p1',
            algo: gpsPlayer,
            position: {
                longitude: 0.012,
                latitude: 51.389,
                accuracy: null,
                heading: null,
                speed: null,
                timestamp: null,
                altitude: null,
                altitudeAccuracy: null
            },
        },
        {
            name: 'p2',
            algo: passivePlayer,
            position: {
                longitude: 0.012,
                latitude: 51.389,
                accuracy: null,
                heading: null,
                speed: null,
                timestamp: null,
                altitude: null,
                altitudeAccuracy: null
            },
        }
    ],
    gameCode);
}