import * as SharedGame from '../shared/game'
import * as kalman from './kalman'

import * as Sentry from '@sentry/browser';

Sentry.init({ dsn: 'https://0622ee38668548dcb4af966730298b31@o428868.ingest.sentry.io/5374680' });
if (process.env.SENTRY_TESTS == "true") {
    Sentry.captureException(new Error("sentry test archived.html"));
}

const cookieGameId = decodeURIComponent(document.cookie.replace(/(?:(?:^|.*;\s*)gameId\s*\=\s*([^;]*).*$)|^.*$/, "$1"));

let urlGameId = window.location.href.split('/').pop()
let publicId: number;
//todo: use to let people download results
// let privateId: string;
// we only let users have cookies for one game at a time at the moment
// so check they're for the current and treat the as observer if not
if (cookieGameId == urlGameId) {
    // privateId = document.cookie.replace(/(?:(?:^|.*;\s*)privateId\s*\=\s*([^;]*).*$)|^.*$/, "$1");
    publicId = parseInt(document.cookie.replace(/(?:(?:^|.*;\s*)publicId\s*\=\s*([^;]*).*$)|^.*$/, "$1"));
}

function getPlayerColor(playerPublicId: number) {
    //todo: let player choose and store in game
    return playerColours[playerPublicId % playerColours.length];
}

var gameState: SharedGame.ClientGame;
const getData = async () => {
    const response = await fetch(window.location.href + "?format=json");
    gameState = await response.json();
    console.log(gameState);
    let archivedLink = `/archived#${JSON.stringify(gameState)}`;
    (<HTMLLinkElement>document.getElementById("save-in-fragment")).href = archivedLink
    setUpPage(gameState);
    prepareMapData(gameState);

    map = new google.maps.Map(document.getElementById('map')!, {
        zoom: 17,
        mapTypeId: 'satellite',
    });
    annotateMap(true);
}

function setUpPage(gameState: SharedGame.ClientGame) {
    if (publicId) {
        const username = gameState.userList[publicId].username;
        document.getElementById("username")!.innerText = username;
    } else {
        document.getElementById("username")!.innerText = "observer";
    }
    let winner;
    if (gameState.userList[parseInt(gameState.winner!)]) {
        winner = gameState.userList[parseInt(gameState.winner!)].username;
    } else {
        winner = gameState.winner;
    }
    document.getElementById('game-result')!.innerText = `🎉🎉${winner}🎉🎉`
    var targetsState = document.getElementById('targets-state')!;
    let players = Object.keys(gameState.targetsGot!)
    players.sort((a, b) => gameState.targetsGot![parseInt(b)].length - gameState.targetsGot![parseInt(a)].length)
    for (var key of players) {
        var playerPublicId = parseInt(key)
        var outerLi = document.createElement('li');
        outerLi.setAttribute('class', 'player-area')
        var summaryStats = document.createElement('p');
        let username = gameState.userList[playerPublicId].username;
        let total = gameState.targetsGot![playerPublicId].length + gameState.targets![playerPublicId].length;
        let got = gameState.targetsGot![playerPublicId].length;
        summaryStats.innerText = `${username}: ${got}/${total}`
        outerLi.appendChild(summaryStats);
        var ul = document.createElement('ul');
        ul.setAttribute('class', 'target-list')
        outerLi.appendChild(ul);
        let snipeInfoIndex = gameState.latestSnipeIndexes[playerPublicId]
        while(snipeInfoIndex != undefined){
            let snipeInfo = gameState.snipeInfos[snipeInfoIndex]
            var innerLi = document.createElement('li');
            var targetButton = document.createElement('button');
            let targetUsername = gameState.userList[snipeInfo.target].username
            let sniperUsername = gameState.userList[snipeInfo.snipePlayer].username
            targetButton.onclick = function () {
                // todo: show usernames instead
                showPhoto(`${sniperUsername} got ${targetUsername}`, snipeInfo.imageId);
            }
            targetButton.innerText = targetUsername;
            innerLi.appendChild(targetButton);
            ul.prepend(innerLi);
            snipeInfoIndex = snipeInfo.previousSnipe
        }
        targetsState.appendChild(outerLi);
    }
    if (publicId) {
        const username = gameState.userList[publicId].username;
        console.log(username)
        document.getElementById('next-game-link')!.setAttribute('href', `/?code=${gameState.nextCode}&username=${username}`);
    } else {
        document.getElementById('next-game-link')!.hidden = true
    }

    var options = document.getElementById("options")!;
    for (const [playerPublicId, player] of Object.entries(gameState.userList)) {
        var labelItem = document.createElement("li");
        let inputId = `show-player-${player["username"]}`
        var label = document.createElement("label");
        label.innerText = player["username"];
        label.setAttribute('for', inputId)
        let playerColour = getPlayerColor(parseInt(playerPublicId));
        label.setAttribute('style', `background-color: ${playerColour}`);
        options.appendChild(label);
        var input = document.createElement("input");
        input.setAttribute("type", "checkbox");
        input.setAttribute("checked", "true");
        input.addEventListener('change', () => {
            annotateMap(false);
        });
        input.setAttribute("id", inputId);
        labelItem.appendChild(label);
        labelItem.appendChild(input);
        options.appendChild(labelItem);
    }
}

function getDataFromUrl(): SharedGame.ClientGame | undefined{
    let data = decodeURIComponent(window.location.hash.substr(1));
    // todo: we should check it's actually valid after parsing
    if(data.length == 0){
        return undefined
    }else{
        return <SharedGame.ClientGame>JSON.parse(data)
    }
}

window.onload = function () {
    // todo: also try load it from a variable
    // for the case of data embedded in script itself
    console.log('ffff')
    let data = getDataFromUrl();
    console.log(data)
    if(data == undefined){
        getData();
    }
    document.getElementById('show-map')!.onclick = function () {
        document.getElementById('info')!.hidden = !document.getElementById('info')!.hidden;
        document.getElementById('options')!.hidden = !document.getElementById('options')!.hidden;
        if (!document.getElementById('map')!.hidden) {
            map.setOptions({
                zoomControl: true,
                gestureHandling: 'greedy',
                // changing the option doesn't seem to quite be working
                // disableDefaultUI: false,
            });
        } else {
            document.getElementById('options')!.hidden = true;
            map.setOptions({
                zoomControl: false,
                gestureHandling: 'none',
                // disableDefaultUI: true,
            });
        }
    }
    document.getElementById('photo-back')!.onclick = function () {
        document.getElementById('photo-div')!.hidden = true;
        document.getElementById('main')!.hidden = false;
        (<HTMLImageElement>document.getElementById('photo')).src = window.location.href + "/shitty_loader.jpg";

    }
};

interface PlayerSnipe {
    marker: google.maps.Marker,
    arrow?: google.maps.Polyline
}

var mapData: {
    playerPaths: { [key: number]: google.maps.Polyline },
    rawPlayerPaths: { [key: number]: google.maps.Polyline },
    playerSnipes: { [key: number]: PlayerSnipe[] }
} = {
    playerPaths: [],
    rawPlayerPaths: [],
    playerSnipes: [],
};

// hardcode distinct colours, and reuse if too many players
// todo: find a js library to handle colour generation
var playerColours = [
    "#FFB300",  //Vivid Yellow
    "#803E75",  //Strong Purple
    "#FF6800",  //Vivid Orange
    "#A6BDD7",  //Very Light Blue
    "#C10020",  //Vivid Red
    "#CEA262",  //Grayish Yellow
    "#817066",  //Medium Gray

    // The following don't work well for people with defective color vision
    "#007D34",  //Vivid Green
    "#F6768E",  //Strong Purplish Pink
    "#00538A",  //Strong Blue
    "#FF7A5C",  //Strong Yellowish Pink
    "#53377A",  //Strong Violet
    "#FF8E00",  //Vivid Orange Yellow
    "#B32851",  //Strong Purplish Red
    "#F4C800",  //Vivid Greenish Yellow
    "#7F180D",  //Strong Reddish Brown
    "#93AA00",  //Vivid Yellowish Green
    "#593315",  //Deep Yellowish Brown
    "#F13A13",  //Vivid Reddish Orange
    "#232C16",  //Dark Olive Green
];

function prepareMapData(gameState: SharedGame.ClientGame) {
    let forSentry: {[key: string]: any[]} = {}
    for(const [playerId, positions] of Object.entries(gameState.positions!)){
        forSentry[playerId] = []
        for(let position of positions){
            forSentry[playerId].push(JSON.stringify(position))
        }
    }
    console.log(gameState.positions)
    console.log(forSentry)
    // Sentry.captureEvent({
    //     message: "raw gps data",
    //     extra: {"positions": forSentry}
    // })
    for (const [playerPublicIdString,] of Object.entries(gameState.userList)) {
        var path = [];
        let rawPath = [];
        let playerPublicId = parseInt(playerPublicIdString)
        mapData["playerSnipes"][playerPublicId] = [];
        let firstPositionData;
        if(gameState.positions![playerPublicId].length > 0){
            firstPositionData = gameState.positions![playerPublicId][0]
            kalman.init(firstPositionData.longitude!, firstPositionData.latitude!, firstPositionData.accuracy!, firstPositionData.speed!, firstPositionData.heading!, firstPositionData.timestamp!)
        }
        for (var position of gameState.positions![playerPublicId]) {
            // todo: should we compress points where speed=0 into 1 point?
            let {
                x: estLongitude,
                y: estLatitude
            } = kalman.update(position.longitude!, position.latitude!, position.accuracy!, position.speed!, position.heading!, position.timestamp!)
            //estimates are wrong so some reason
            console.log("estimated: " + estLongitude + ", " + estLatitude)
            console.log("actual: " + position.longitude + ", " + position.latitude)
            var rawLatlng: google.maps.ReadonlyLatLngLiteral = { lat: position.latitude!, lng: position.longitude! };
            rawPath.push(rawLatlng);
            var latlng: google.maps.ReadonlyLatLngLiteral = { lat: estLatitude!, lng: estLongitude };
            path.push(latlng);
        }
        var rawPolyLine = new google.maps.Polyline({
            path: rawPath,
            geodesic: true,
            strokeColor: getPlayerColor(playerPublicId + 1),
            strokeOpacity: 1.0,
            strokeWeight: 2
        });
        var polyLine = new google.maps.Polyline({
            path: path,
            geodesic: true,
            strokeColor: getPlayerColor(playerPublicId),
            strokeOpacity: 1.0,
            strokeWeight: 2
        });

        //todo: plot non-snipe images as well
        for(let snipeInfo of gameState.snipeInfos){
            if(snipeInfo.undone){
                continue
            }
            var sniper = gameState.userList[snipeInfo.snipePlayer].username;
            var target = gameState.userList[snipeInfo.target].username;
            let title = `${sniper} got ${target}`
            let latlng: google.maps.ReadonlyLatLngLiteral
            if(snipeInfo.position != undefined){
                latlng = { lat: snipeInfo.position.latitude!, lng: snipeInfo.position.longitude! }; 
            }else{
                // todo: choose a default point
                // middle of the map? interpolation between known positions?
                latlng = { lat: 0, lng: 0 };
            }
            var marker = new google.maps.Marker({
                position: latlng,
                title: title
            });
            marker.addListener('click', function () {
                showPhoto(title, snipeInfo.imageId);
            });

            var obj: PlayerSnipe = { marker: marker, arrow: undefined };

            if (snipeInfo.targetPosition != undefined) {
                var lineSymbol = {
                    path: google.maps.SymbolPath.FORWARD_CLOSED_ARROW
                };
                var targetLatLng: google.maps.ReadonlyLatLngLiteral = {
                    lat: snipeInfo.targetPosition.latitude!,
                    lng: snipeInfo.targetPosition.longitude!,
                };
                var arrow = new google.maps.Polyline({
                    path: [latlng, targetLatLng],
                    icons: [{
                        icon: lineSymbol,
                        offset: '100%'
                    }],
                });
                obj.arrow = arrow;
            }
            mapData["playerSnipes"][playerPublicId].push(obj);
        }

        //todo: this is undefined if player never sends position and so explodes
        //in annotation
        mapData["playerPaths"][playerPublicId] = polyLine;
        mapData["rawPlayerPaths"][playerPublicId] = rawPolyLine;
    }
}

function showPhoto(text: string, imageIndex: number) {
    document.getElementById('photo-div')!.hidden = false;
    document.getElementById('main')!.hidden = true;
    document.getElementById('photo-text')!.innerText = text;
    (<HTMLImageElement>document.getElementById('photo')).src = window.location.href + `/images/${imageIndex}`;
}

var map: google.maps.Map;

function annotateMap(centerMap: boolean) {
    // it's more efficient if we just add/remove the relevant bits when
    // for a specific option that's been changed
    // but this is more flexible for now

    for (const [playerPublicIdString, player] of Object.entries(gameState.userList)) {
        let playerPublicId = parseInt(playerPublicIdString)
        var checkbox = (<HTMLInputElement>document.getElementById(`show-player-${player["username"]}`));
        if (checkbox.checked) {
            mapData["playerPaths"][playerPublicId].setMap(map);
            for(let point of mapData["playerPaths"][playerPublicId].getPath().getArray()){
                new google.maps.Circle({
                    strokeColor: "#FF0000",
                    strokeOpacity: 0.8,
                    strokeWeight: 2,
                    fillColor: "#FF0000",
                    fillOpacity: 0.35,
                    center: point,
                    radius: 0.1
                }).setMap(map);
            }
            mapData["rawPlayerPaths"][playerPublicId].setMap(map);
            for(let point of mapData["rawPlayerPaths"][playerPublicId].getPath().getArray()){
                new google.maps.Circle({
                    strokeColor: "#00FF00",
                    strokeOpacity: 0.8,
                    strokeWeight: 2,
                    fillColor: "#00FF00",
                    fillOpacity: 0.35,
                    center: point,
                    radius: 0.1
                }).setMap(map);
            }
            for (var snipe of mapData["playerSnipes"][playerPublicId]) {
                snipe["marker"].setMap(map);
                //this might not be set if the target never sent a position
                if (snipe["arrow"]) {
                    snipe["arrow"].setMap(map);
                }
            }
        } else {
            mapData["playerPaths"][playerPublicId].setMap(null);
            for (var snipe of mapData["playerSnipes"][playerPublicId]) {
                snipe["marker"].setMap(null);
                if (snipe["arrow"]) {
                    snipe["arrow"].setMap(null);
                }
            }
        }
    }
    //center on when they started
    //instead we should capture the agreed starting point of the game and use that
    //current approach also breaks for observers without a publicId
    if(centerMap){
        if (publicId) {
            map.setCenter(mapData["playerPaths"][publicId].getPath().getAt(0));
        } else {
            map.setCenter(mapData["playerPaths"][0].getPath().getAt(0));
        }
    }
}
