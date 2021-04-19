import * as SharedGame from '../shared/game';
import * as api from '../shared/clientApi';
// import * as kalman from './kalman';
import {MapData} from './mapAnnotations';
import * as Game from './game';

import * as Sentry from '@sentry/browser';

Sentry.init({ dsn: 'https://0622ee38668548dcb4af966730298b31@o428868.ingest.sentry.io/5374680' });
if (process.env.SENTRY_TESTS == "true") {
    Sentry.captureException(new Error("sentry test archived.html"));
}

function urlGameId(): string{
    return window.location.href.split('/').pop()!;
}

function getPublicId(): number|undefined{
    const cookieGameId = decodeURIComponent(document.cookie.replace(/(?:(?:^|.*;\s*)gameId\s*\=\s*([^;]*).*$)|^.*$/, "$1"));

    if (cookieGameId == urlGameId()) {
        let publicId = parseInt(document.cookie.replace(/(?:(?:^|.*;\s*)publicId\s*\=\s*([^;]*).*$)|^.*$/, "$1"));
        if(isNaN(publicId)){
            return undefined;
        }
        return publicId;
    }
    return undefined;
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

function buildPlayerTickBox(publicId: number, username: string){
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
        var checkbox = (<HTMLInputElement>document.getElementById(`show-player-${username}`));
        if (checkbox.checked) {
            mapData.showPlayer(publicId);
        }else{
            mapData.hidePlayer(publicId);
        }
    });
    input.setAttribute("id", inputId);
    labelItem.appendChild(label);
    labelItem.appendChild(input);
    return labelItem
}

function setUpPage(gameState: SharedGame.ClientGame, publicId?: number) {
    if (publicId != undefined) {
        const username = gameState.userList[publicId].username;
        document.getElementById("username")!.innerText = username;
    } else {
        document.getElementById("username")!.innerText = "observer";
    }
    
    let winner;
    if (gameState.winner && !isNaN(parseInt(gameState.winner))) {
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

    if (publicId != undefined) {
        const username = Game.getUsername(publicId)
        document.getElementById('next-game-link')!.setAttribute('href', `/?code=${gameState.nextCode}&username=${username}`);
    } else {
        // todo: also check the game data was live from the API before showing
        document.getElementById('next-game-link')!.hidden = true
    }

    var options = document.getElementById("options")!;
    for (let playerPublicId of Game.getPublicIds()) {
        let labelItem = buildPlayerTickBox(playerPublicId, Game.getUsername(playerPublicId))
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

async function getDataFromApi(): Promise<SharedGame.ClientGame>{
    let gameId = urlGameId();
    let gameState = api.gameJson(gameId);
    return gameState;
}

var map: google.maps.Map;
let gameState: SharedGame.ClientGame;
let mapData: MapData;

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

        setUpPage(gameState, publicId);
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

        mapData = new MapData(gameState, map, showPhoto, playerColours);
        // observers won't have a public ID
        if(publicId != undefined){
            mapData.center(publicId);
        }else{
            mapData.center();
        }
    }, _=>{
        // this looks terribad - change to a local hide/show thing
        window.location.replace("/static/game_doesnt_exist.html")
    })

    document.getElementById('show-map')!.onclick = function () {
        document.getElementById('info')!.hidden = !document.getElementById('info')!.hidden;
        document.getElementById('options')!.hidden = !document.getElementById('options')!.hidden;
    }
    document.getElementById('photo-back')!.onclick = function () {
        document.getElementById('photo-div')!.hidden = true;
        document.getElementById('main')!.hidden = false;
        (<HTMLImageElement>document.getElementById('photo')).src = "/static/shitty_loader.jpg";
    }

    document.getElementById('time-lapse')!.oninput = function(){
        let sliderValue = Number.parseInt((<HTMLInputElement>document.getElementById('time-lapse')).value);

        let sliderPercent = sliderValue / 1000;

        let startTime = Game.startTime();
        let endTime = Game.endTime();

        let scaledMaxTime = startTime + (endTime - startTime)*sliderPercent;

        mapData.changeTimeRange(0, scaledMaxTime);
    };
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

function showPhoto(text: string, imageIndex: number) {
    document.getElementById('photo-div')!.hidden = false;
    document.getElementById('main')!.hidden = true;
    document.getElementById('photo-text')!.innerText = text;
    (<HTMLImageElement>document.getElementById('photo')).src = Game.getImageUrl(imageIndex, false)!;
}
