import * as SharedGame from '../shared/game'
import * as kalman from './kalman'
import * as Game from './game'

import * as Sentry from '@sentry/browser';
// import { game } from './game';
// import { rejects } from 'assert';

Sentry.init({ dsn: 'https://0622ee38668548dcb4af966730298b31@o428868.ingest.sentry.io/5374680' });
if (process.env.SENTRY_TESTS == "true") {
    Sentry.captureException(new Error("sentry test archived.html"));
}

function getPublicId(): number|undefined{
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
        return publicId
    }
}

function getPlayerColor(playerPublicId: number) {
    //todo: let player choose and store in game
    return playerColours[playerPublicId % playerColours.length];
}

function buildTargetsState(playerPublicId: number){
    var outerLi = document.createElement('li');
    outerLi.setAttribute('class', 'player-area')
    var summaryStats = document.createElement('p');

    let username = Game.getUsername(playerPublicId)
    let [got, remaining] = Game.getPlayerProgress(playerPublicId)
    let total = got + remaining

    summaryStats.innerText = `${username}: ${got}/${total}`
    
    outerLi.appendChild(summaryStats);
    var ul = document.createElement('ul');
    ul.setAttribute('class', 'target-list')
    outerLi.appendChild(ul);
    for(let snipeInfo of Game.getSnipeInfos(playerPublicId)){
        var innerLi = document.createElement('li');
        var targetButton = document.createElement('button');
        let targetUsername = Game.getUsername(snipeInfo.target)
        let sniperUsername = Game.getUsername(snipeInfo.snipePlayer)
        targetButton.onclick = function () {
            showPhoto(`${sniperUsername} got ${targetUsername}`, snipeInfo.imageId);
        }
        targetButton.innerText = targetUsername;
        innerLi.appendChild(targetButton);
        ul.prepend(innerLi);
    }
    return outerLi
}

function buildPlayerTickBox(publicId: number, username: string, mapData: MapData){
    var labelItem = document.createElement("li");
    let inputId = `show-player-${username}`
    var label = document.createElement("label");
    label.innerText = username;
    label.setAttribute('for', inputId)
    let playerColour = getPlayerColor(publicId);
    label.setAttribute('style', `background-color: ${playerColour}`);
    var input = document.createElement("input");
    input.setAttribute("type", "checkbox");
    input.setAttribute("checked", "true");
    input.addEventListener('change', () => {
        annotateMap(false, mapData, publicId);
    });
    input.setAttribute("id", inputId);
    labelItem.appendChild(label);
    labelItem.appendChild(input);
    return labelItem
}

function setUpPage(gameState: SharedGame.ClientGame, mapData: MapData, publicId?: number) {
    if (publicId) {
        const username = gameState.userList[publicId].username;
        document.getElementById("username")!.innerText = username;
    } else {
        document.getElementById("username")!.innerText = "observer";
    }
    
    let winner;
    if (gameState.winner && parseInt(gameState.winner)) {
        winner = gameState.userList[parseInt(gameState.winner!)].username;
    } else {
        winner = gameState.winner;
    }
    document.getElementById('game-result')!.innerText = `🎉🎉${winner}🎉🎉`
    
    var targetsState = document.getElementById('targets-state')!;
    for (let playerPublicId of Game.getPublicIds(true)) {
        let outerLi = buildTargetsState(playerPublicId)
        targetsState.appendChild(outerLi);
    }

    if (publicId) {
        const username = Game.getUsername(publicId)
        document.getElementById('next-game-link')!.setAttribute('href', `/?code=${gameState.nextCode}&username=${username}`);
    } else {
        // todo: also check the game data was live from the API before showing
        document.getElementById('next-game-link')!.hidden = true
    }

    var options = document.getElementById("options")!;
    for (let playerPublicId of Game.getPublicIds()) {
        let labelItem = buildPlayerTickBox(playerPublicId, Game.getUsername(playerPublicId), mapData)
        options.appendChild(labelItem);
    }
}

function getDataFromUrlFragment(): Promise<SharedGame.ClientGame>{
    let a = new Promise<SharedGame.ClientGame>((resolve, reject) => {
        let data = decodeURIComponent(window.location.hash.substr(1));
        // todo: we should check it's actually valid after parsing
        if(data.length == 0){
            reject()
        }else{
            resolve(<SharedGame.ClientGame>JSON.parse(data))
        }
    })
    return a;
}

async function getDataFromApi(){
    const response = await fetch(window.location.href + "?format=json");
    let gameState: SharedGame.ClientGame = await response.json();
    return gameState;
}

let gameState: SharedGame.ClientGame

window.onload = function () {
    // todo: also try load it from a variable
    // for the case of data embedded in script itself
    getDataFromUrlFragment()
    .catch(getDataFromApi)
    .then((lgameState: SharedGame.ClientGame) => {
        gameState = lgameState
        let archivedLink = `/archived#${JSON.stringify(gameState)}`;
        (<HTMLLinkElement>document.getElementById("save-in-fragment")).href = archivedLink
    
        let publicId = getPublicId()

        Game.update(gameState)

        let mapData = prepareMapData(gameState);
        setUpPage(gameState, mapData, publicId);
        map = new google.maps.Map(document.getElementById('map')!, {
            zoom: 17,
            mapTypeId: 'satellite',
        });
        map.setOptions({
            zoomControl: true,
            gestureHandling: 'greedy',
            // changing the option doesn't seem to quite be working
            // disableDefaultUI: false,
        });
        annotateMap(true, mapData, publicId);
    })

    document.getElementById('show-map')!.onclick = function () {
        document.getElementById('info')!.hidden = !document.getElementById('info')!.hidden;
        document.getElementById('options')!.hidden = !document.getElementById('options')!.hidden;
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

interface MapData {
    playerPaths: { [key: number]: google.maps.Polyline },
    rawPlayerPaths: { [key: number]: google.maps.Polyline },
    playerSnipes: { [key: number]: PlayerSnipe[] },
    points: { [key: number]: google.maps.Circle[]},
    rawPoints: { [key: number]: google.maps.Circle[]}
}

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

function processedPath(positions: SharedGame.Position[], playerPublicId: number){
    let path = [];
    let pointMarkers = []
    let firstPositionData;
    firstPositionData = positions[0]
    kalman.init(
        firstPositionData.longitude!,
        firstPositionData.latitude!,
        firstPositionData.accuracy!,
        firstPositionData.speed!,
        firstPositionData.heading!,
        firstPositionData.timestamp!)
    for (var position of positions) {
        console.log(position)
        // todo: should we compress points where speed=0 into 1 point?
        let {
            x: estLongitude,
            y: estLatitude
        } = kalman.update(position.longitude!, position.latitude!, position.accuracy!, position.speed!, position.heading!, position.timestamp!)
        var latlng: google.maps.ReadonlyLatLngLiteral = { lat: estLatitude!, lng: estLongitude };
        path.push(latlng);
        pointMarkers.push(new google.maps.Circle({
            strokeColor: "#00FF00",
            strokeOpacity: 0.8,
            strokeWeight: 2,
            fillColor: "#00FF00",
            fillOpacity: 0.35,
            center: latlng,
            radius: 0.1
        }));
    }

    // todo: this makes the line dashed
    // once processed path is better then the raw
    // make the raw one dashed
    const lineSymbol = {
        path: "M 0,-1 0,1",
        strokeOpacity: 1,
        scale: 4,
      };

    var polyLine = new google.maps.Polyline({
        path: path,
        geodesic: true,
        strokeColor: getPlayerColor(playerPublicId),
        strokeOpacity: 0,
        icons: [
          {
            icon: lineSymbol,
            offset: "0",
            repeat: "20px",
          },
        ],
        // strokeOpacity: 1.0,
        strokeWeight: 2
    });
    return {
        polyLine: polyLine, points: pointMarkers
    }
}

function rawPath(positions: SharedGame.Position[], playerPublicId: number){
    let rawPath = [];
    let pointMarkers = []
    for (var position of positions) {
        let rawLatlng: google.maps.ReadonlyLatLngLiteral = { lat: position.latitude!, lng: position.longitude! };
        rawPath.push(rawLatlng);


        pointMarkers.push(new google.maps.Circle({
            strokeColor: "#00FF00",
            strokeOpacity: 0.8,
            strokeWeight: 2,
            fillColor: "#00FF00",
            fillOpacity: 0.35,
            center: rawLatlng,
            radius: 0.1
        }));
    }

    var rawPolyLine = new google.maps.Polyline({
        path: rawPath,
        geodesic: true,
        strokeColor: getPlayerColor(playerPublicId),
        strokeOpacity: 1.0,
        strokeWeight: 2
    });

    return {
        polyLine: rawPolyLine, points: pointMarkers
    }
}

function prepareMapData(gameState: SharedGame.ClientGame) {

    let mapData: MapData = {
        playerPaths: [],
        rawPlayerPaths: [],
        playerSnipes: [],
        points: [],
        rawPoints: [],
    };

    for (const playerPublicId of Game.getPublicIds()) {
        let positions = gameState.positions![playerPublicId]
        if(positions.length != 0){
            let data = processedPath(positions, playerPublicId);
            mapData.points[playerPublicId] = data.points
            mapData.playerPaths[playerPublicId] = data.polyLine
            let rawData = rawPath(positions, playerPublicId);
            mapData.rawPoints[playerPublicId] = rawData.points
            mapData.rawPlayerPaths[playerPublicId] = rawData.polyLine
        }

        mapData.playerSnipes[playerPublicId] = [];
        //todo: plot non-snipe images as well
        for(let snipeInfo of gameState.snipeInfos){
            if(snipeInfo.undone){
                //todo: show them but greyed out or w/e
                continue
            }
            var sniper = Game.getUsername(snipeInfo.snipePlayer);
            var target = Game.getUsername(snipeInfo.target);
            let latlng: google.maps.ReadonlyLatLngLiteral
            if(snipeInfo.position != undefined){
                latlng = { lat: snipeInfo.position.latitude!, lng: snipeInfo.position.longitude! }; 
            }else{
                // todo: choose a default point
                // middle of the map? interpolation between known positions?
                latlng = { lat: 0, lng: 0 };
            }
            let title = `${sniper} got ${target}`
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
            mapData.playerSnipes[playerPublicId].push(obj);
        }
    }
    return mapData
}

function showPhoto(text: string, imageIndex: number) {
    document.getElementById('photo-div')!.hidden = false;
    document.getElementById('main')!.hidden = true;
    document.getElementById('photo-text')!.innerText = text;
    (<HTMLImageElement>document.getElementById('photo')).src = window.location.href + `/images/${imageIndex}`;
}

var map: google.maps.Map;

function annotateMap(centerMap: boolean, mapData: MapData, publicId?: number) {
    // it's more efficient if we just add/remove the relevant bits when
    // for a specific option that's been changed
    // but this is more flexible for now

    for (const [playerPublicIdString, player] of Object.entries(gameState.userList)) {
        let playerPublicId = parseInt(playerPublicIdString)
        var checkbox = (<HTMLInputElement>document.getElementById(`show-player-${player["username"]}`));
        // todo: check all the mapData objects instead of only playerPaths and assuming they're in sync
        if(!mapData.playerPaths[playerPublicId]){
            continue
        }
        if (checkbox.checked) {
            mapData.playerPaths[playerPublicId].setMap(map);
            for(let point of mapData.points[playerPublicId]){
                point.setMap(map)
            }
            mapData.rawPlayerPaths[playerPublicId].setMap(map);
            for(let point of mapData.rawPoints[playerPublicId]){
                point.setMap(map)
            }
            for (var snipe of mapData["playerSnipes"][playerPublicId]) {
                snipe["marker"].setMap(map);
                //this might not be set if the target never sent a position
                if (snipe["arrow"]) {
                    snipe["arrow"].setMap(map);
                }
            }
        } else {
            mapData.playerPaths[playerPublicId].setMap(null);
            for(let point of mapData.points[playerPublicId]){
                point.setMap(null)
            }
            mapData.rawPlayerPaths[playerPublicId].setMap(null);
            for(let point of mapData.rawPoints[playerPublicId]){
                point.setMap(null)
            }
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
