// Sentry is on adblocker lists, so we can't depend on it working
// https://github.com/getsentry/sentry-javascript/issues/668
if(typeof variable !== 'undefined'){
    Sentry.init({ dsn: 'https://0622ee38668548dcb4af966730298b31@o428868.ingest.sentry.io/5374680' });
    //todo: when we have a build process for this page
    // if(process.env.SENTRY_TESTS == "true"){
    Sentry.captureException(new Error("sentry test archieved.html"));
    //}
}
const cookieGameId = decodeURIComponent(document.cookie.replace(/(?:(?:^|.*;\s*)gameId\s*\=\s*([^;]*).*$)|^.*$/, "$1"));

let urlGameId = window.location.href.split('/').pop()
let privateId;
let publicId;
// we only let users have cookies for one game at a time at the moment
// so check they're for the current and treat the as observer if not
if(cookieGameId == urlGameId){
    privateId = document.cookie.replace(/(?:(?:^|.*;\s*)privateId\s*\=\s*([^;]*).*$)|^.*$/, "$1");
    publicId = document.cookie.replace(/(?:(?:^|.*;\s*)publicId\s*\=\s*([^;]*).*$)|^.*$/, "$1");
}

function getPlayerColor(playerPublicId){
    //todo: let player choose and store in game
    return playerColours[playerPublicId%playerColours.length];
}

let playerEmojis = [
    "😀",
    "😗",
    "🕶",
    "🐵",
    "🐶",
    "🦄",
    "🦋",
    "🐌",
    "🦠",
    "🦃",
    "🦆",
    "🦉",
    "🦜",
    "🐋",
    "🐡",
    "🦈",
    "🐙",
    "🌻",
    "🌵",
    "☘"
];

function getPlayerEmoji(playerPublicId){
    //todo: let player choose and store in game
    return playerEmojis[playerPublicId%playerEmojis.length];
}

function getIndexForTarget(playerPublicId, targetGotIndex){
    // todo: store the mapping on the gmestate so we don't have to do this crap
    // todo: handle undos
    return 0;
}

var gameState;
const getData = async () => {
    const response = await fetch(window.location.href + "?format=json");
    gameState = await response.json();
    console.log(gameState);
    setUpPage(gameState);
    initMap();
    annotateMap();
}

function setUpPage(gameState) {
    if(publicId){
        const username = gameState.userList[publicId].username;
        document.getElementById("username").innerText = username;
    }else{
        document.getElementById("username").innerText = "observer";
    }
    let winner;
    if (gameState.userList[gameState.winner]) {
        winner = gameState.userList[gameState.winner].username;
    } else {
        winner = gameState.winner;
    }
    document.getElementById('game-result').innerText = `🎉🎉${winner}🎉🎉`
    var targetsState = document.getElementById('targets-state');
    let players = Object.keys(gameState.targetsGot)
    players.sort((a, b) => gameState.targetsGot[a].length < gameState.targetsGot[b].length)
    for (var key of players) {
        var outerLi = document.createElement('li');
        outerLi.setAttribute('class', 'player-area')
        var innerLi = document.createElement('p');
        let username = gameState.userList[key].username;
        let total = gameState.targetsGot[key].length + gameState.targets[key].length;
        let got = gameState.targetsGot[key].length;
        innerLi.innerText = `${username}: ${got}/${total}`
        outerLi.appendChild(innerLi);
        var ul = document.createElement('ul');
        ul.setAttribute('class', 'target-list')
        outerLi.appendChild(ul);
        for(let [index, got] of gameState.targetsGot[key].entries()){
            var innerLi = document.createElement('li');
            var targetButton = document.createElement('button');
            targetButton.onclick = function(){
                showPhoto("wip", key, getIndexForTarget(key, index));
            }
            targetButton.innerText = gameState.userList[got].username;
            innerLi.appendChild(targetButton);
            ul.appendChild(innerLi);
        }
        targetsState.appendChild(outerLi);
    }
    if(publicId){
        const username = gameState.userList[publicId].username;
        console.log(username)
        document.getElementById('next-game-link').setAttribute('href', `/?code=${gameState.nextCode}&username=${username}`);
    }else{
        document.getElementById('next-game-link').hidden = true
    }

    var options = document.getElementById("options");
    for(const [playerPublicId, player] of Object.entries(gameState.userList)){
        var labelItem = document.createElement("li");
        let inputId = `show-player-${player.username}`
        var label = document.createElement("label");
        label.innerText = player.username;
        label.setAttribute('for', inputId)
        let playerColour = getPlayerColor(playerPublicId);
        label.setAttribute('style', `background-color: ${playerColour}`);
        options.appendChild(label);
        var input = document.createElement("input");
        input.setAttribute("type", "checkbox");
        input.setAttribute("checked", true);
        input.addEventListener('change', () => {
            annotateMap();
        });
        input.setAttribute("id", inputId);
        labelItem.appendChild(label);
        labelItem.appendChild(input);
        options.appendChild(labelItem);
    }
}

window.onload = function () {
    getData();
    document.getElementById('show-map').onclick = function(){
        document.getElementById('info').hidden = !document.getElementById('info').hidden;
        document.getElementById('options').hidden = !document.getElementById('options').hidden;
        if(!document.getElementById('map').hidden){
            map.setOptions({
                zoomControl: true,
                gestureHandling: 'greedy',
                // changing the option doesn't seem to quite be working
                // disableDefaultUI: false,
            });
        }else{
            document.getElementById('options').hidden = true;
            map.setOptions({
                zoomControl: false,
                gestureHandling: 'none',
                // disableDefaultUI: true,
            });
        }
    }
    document.getElementById('photo-back').onclick = function(){
        document.getElementById('photo-div').hidden = true;
        document.getElementById('main').hidden = false;
        document.getElementById('photo').src = window.location.href + "/shitty_loader.jpg";

    }
};

var mapData = {
    "playerPaths": [],
    "playerSnipes": [],
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

function prepareMapData(gameState){
    for(const [playerPublicId, player] of Object.entries(gameState.userList)){
        var path = [];
        mapData["playerSnipes"][playerPublicId] = [];
        for(var position of gameState.positions[playerPublicId]){
            var latlng = {lat: position.latitude, lng: position.longitude};
            path.push(latlng);
        }
        var polyLine = new google.maps.Polyline({
            path: path,
            geodesic: true,
            strokeColor: getPlayerColor(playerPublicId),
            strokeOpacity: 1.0,
            strokeWeight: 2
        });
        if(gameState.imageMetadata[playerPublicId]){
            for(const [index, metadata] of gameState.imageMetadata[playerPublicId].entries()){
                let title = `Picture by ${sniper}`
                if(metadata["snipeNumber"] != undefined){
                    var sniper = gameState.userList[playerPublicId].username;
                    //todo: simplify snipe number - its complex and stupid
                    let totalTargets = gameState.targetsGot[playerPublicId].length + gameState.targets[playerPublicId].length
                    let targetIndex = totalTargets - metadata["snipeNumber"]
                    var target = gameState.userList[gameState.targetsGot[playerPublicId][targetIndex]].username;
                    title = `${sniper} got ${target}`
                }
                var latlng = {lat: metadata.position.latitude, lng: metadata.position.longitude};
                var marker = new google.maps.Marker({
                    position: latlng,
                    title: title
                });
                marker.addListener('click', function() {
                    showPhoto(title, playerPublicId, index);
                });

                var obj = {"marker": marker};

                if(metadata["targetPosition"]){
                    var lineSymbol = {
                        path: google.maps.SymbolPath.FORWARD_CLOSED_ARROW
                    };
                    var targetLatLng = {
                        lat: metadata["targetPosition"].latitude,
                        lng: metadata["targetPosition"].longitude,
                    };
                    var arrow = new google.maps.Polyline({
                        path: [latlng, targetLatLng],
                        icons: [{
                            icon: lineSymbol,
                            offset: '100%'
                        }],
                    });
                    obj["arrow"] = arrow;
                }
                mapData["playerSnipes"][playerPublicId].push(obj);
            }
        }
        //todo: this is undefined if player never sends position and so explodes
        //in annotation
        mapData["playerPaths"][playerPublicId] = polyLine;
    }
}

function showPhoto(text, playerPublicId, index){
    document.getElementById('photo-div').hidden = false;
    document.getElementById('main').hidden = true;
    document.getElementById('photo-text').innerText = text;
    document.getElementById('photo').src = window.location.href + "?format=json&publicId="+playerPublicId+"&index="+index;
}

var map;

function annotateMap(){
    // it's more efficient if we just add/remove the relevant bits when
    // for a specific option that's been changed
    // but this is more flexable for now

    for(const [playerPublicId, player] of Object.entries(gameState.userList)){
        var checkbox = document.getElementById(`show-player-${player.username}`);
        if(checkbox.checked){
            mapData["playerPaths"][playerPublicId].setMap(map);
            for(var snipe of mapData["playerSnipes"][playerPublicId]){
                snipe["marker"].setMap(map);
                //this might not be set if the target never sent a position
                if(snipe["arrow"]){
                    snipe["arrow"].setMap(map);
                }
            }
        }else{
            mapData["playerPaths"][playerPublicId].setMap(null);
            for(var snipe of mapData["playerSnipes"][playerPublicId]){
                snipe["marker"].setMap(null);
                if(snipe["arrow"]){
                    snipe["arrow"].setMap(null);
                }
            }
        }
    }
    //center on when they started
    //instead we should capture the agreed starting point of the game and use that
    //current approach also breaks for observers without a publicId
    if(publicId){
        map.setCenter(mapData["playerPaths"][publicId].getPath().getAt(0));
    }else{
        map.setCenter(mapData["playerPaths"][0].getPath().getAt(0));
    }
}

var ready = false;
function initMap() {
    //hack to check that both google maps is loaded
    // and game data has been fetched
    if (!ready) {
        ready = true;
        return;
    }

    prepareMapData(gameState);

    map = new google.maps.Map(document.getElementById('map'), {
        zoom: 17,
        mapTypeId: 'satellite',
    });
}