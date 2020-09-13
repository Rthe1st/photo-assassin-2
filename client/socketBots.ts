// purpose of this is for testing the server
// and allowing AI opponents
// without the need for a browser

import * as socketClient from './socketClient.js';
import fetch from 'node-fetch';
import fs from 'fs';
import randomSeed from 'random-seed';
import * as SharedGame from '../shared/game.js';

let domain = "http://localhost:3000";

export function useProd() {
    domain = "https://photo-assassin.prangten.com";
}

function makeGame(username: string) {
    const url = `${domain}/make?username=${username}&format=json`;

    const getData = async (url: string) => {
        const response = await fetch(url);
        const json = await response.json();
        return json;
    };

    return getData(url);

}

function joinGame(username: string, gameId: string) {
    const url = `${domain}/join?code=${gameId}&username=${username}&format=json`;

    const getData = async (url: string) => {
        const response = await fetch(url);
        const json = await response.json();
        return json;
    };

    return getData(url);
}

interface Player {
    name: string;
    algo: (gameId: string, privateId: string, player: Player, publicId: number) => SocketIOClient.Socket;
    position: SharedGame.Position;
}

async function gameSetup(players: Player[]) {
    if (players.length == 0) {
        console.log("no player supplied")
        return;
    }
    let hostPlayer = players.shift()!;
    let details = await makeGame(hostPlayer.name);
    console.log(details);
    console.log(`${domain}/game/${details["gameId"]}`);
    let gameId = details.gameId;
    let sockets = new Map();
    let socket = hostPlayer.algo(details.gameId, details.privateId, hostPlayer, details.publicId);
    sockets.set(details.publicId, socket);
    for (let player of players) {
        let details = await joinGame(player.name, gameId);
        let socket = player.algo(details.gameId, details.privateId, player, details.publicId);
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
                socketClient.makeTargets(socket, { gameLength: 60000, countDown: 0, proposedTargetList: msg.gameState.chosenSettings.proposedTargetList });
            }
        },
        () => { },
        () => { },
        () => { },
        (_) => {
            console.log('make targets')
            socketClient.startGame(socket);
        },
        () => { },
        (_) => {
            console.log('start')
            let file = fs.readFileSync('./server/sample_snipe_image.jpeg');
            let message = {
                "text": "gotya",
                "image": file,
                "position": { "latitude": player.position.latitude, "longitude": player.position.longitude },
                "isSnipe": true,
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
            let file = fs.readFileSync('./server/sample_snipe_image.jpeg');
            let message = {
                "text": "gotya",
                "image": file,
                "position": { "latitude": player.position.latitude, "longitude": player.position.longitude },
                "isSnipe": randomGenerator(100) > 50,
            }
            socketClient.chatMessage(socket, message);
        },
        domain
    );
    return socket;
}

function passivePlayer(gameId: string, privateId: string, player: Player) {
    let socket = socketClient.setup(
        gameId,
        privateId,
        () => { },
        () => { },
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
            socketClient.positionUpdate(socket, { "latitude": player.position.latitude, "longitude": player.position.longitude });
        },
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
                let file = fs.readFileSync('./server/sample_snipe_image.jpeg');
                let message = {
                    "text": "gotya",
                    "image": file,
                    "position": { "latitude": player.position.latitude, "longitude": player.position.longitude },
                    "isSnipe": true,
                }
                socketClient.chatMessage(socket, message);
            } else if (command == "move") {
                console.log("moving");
                player.position.latitude! += (Math.random() - 0.5) * 0.001;
                player.position.longitude! += (Math.random() - 0.5) * 0.001;
                socketClient.positionUpdate(socket, { "latitude": player.position.latitude, "longitude": player.position.longitude });
            } else if (command == "picture") {
                console.log("pictureing");
                let file = fs.readFileSync('./server/sample_snipe_image.jpeg');
                let message = {
                    "text": "gotya",
                    "image": file,
                    "position": { "latitude": player.position.latitude, "longitude": player.position.longitude },
                    "isSnipe": false,
                }
                socketClient.chatMessage(socket, message);
            } else if (command == "message") {
                console.log("messging");
                let message: socketClient.ClientChatMessage = {
                    text: "blahblah",
                    position: { "latitude": player.position.latitude, "longitude": player.position.longitude },
                    image: undefined,
                    isSnipe: undefined,
                }
                socketClient.chatMessage(socket, message);
            } else if (command == "badsnipe" && parts.length == 4) {
                console.log("badsniping");
                let msg: socketClient.ClientBadSnipe = {
                    snipeNumber: parseInt(parts[2]),
                    sniperPlayer: parseInt(parts[3])
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
            socketClient.positionUpdate(socket, { "latitude": player.position.latitude, "longitude": player.position.longitude });
        },
        () => {
            console.log("game over");
        },
        () => { },
        processCommand,
        domain
    );
    return socket;
}

export function activeGame() {
    gameSetup([
        {
            name: 'p1',
            algo: passivePlayer,
            position: { latitude: 51.389, longitude: 0.012 }
        },
        {
            name: 'p2',
            algo: passivePlayer,
            position: { latitude: 51.389, longitude: 0.012 }
        },
        {
            name: 'p3',
            algo: passivePlayer,
            position: { latitude: 51.389, longitude: 0.012 }
        }, {
            name: 'simpleSloth',
            algo: activePlayer,
            position: { latitude: 51.389, longitude: 0.012 }
        }]);
}

export function passiveGame() {
    gameSetup([
        {
            name: 'p1',
            algo: passivePlayer,
            position: { latitude: 51.389, longitude: 0.012 }
        },
        {
            name: 'p2',
            algo: passivePlayer,
            position: { latitude: 51.389, longitude: 0.012 }
        },
        {
            name: 'p3',
            algo: passivePlayer,
            position: { latitude: 51.389, longitude: 0.012 }
        }, {
            name: 'simpleSloth',
            algo: passivePlayer,
            position: { latitude: 51.389, longitude: 0.012 }
        }]);
}

export function listenGame() {
    gameSetup([
        {
            name: 'p1',
            algo: listeningPlayer,
            position: { latitude: 51.389, longitude: 0.012 }
        },
        {
            name: 'p2',
            algo: listeningPlayer,
            position: { latitude: 51.389, longitude: 0.012 }
        },
        {
            name: 'p3',
            algo: listeningPlayer,
            position: { latitude: 51.389, longitude: 0.012 }
        }, {
            name: 'simpleSloth',
            algo: listeningPlayer,
            position: { latitude: 51.389, longitude: 0.012 }
        }]);
}
