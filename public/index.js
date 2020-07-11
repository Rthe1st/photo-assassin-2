var position = { latitude: null, longitude: null };
function updatePosition(geolocation) {
    position.latitude = geolocation.coords.latitude;
    position.longitude = geolocation.coords.longitude;
}
function dontUpdatePosition(a) {
    console.log("geo loc failed");
    console.log(a);
}

function targetDisplay(targets) {
    users = Object.keys(targets);
    output = "";
    for (var i = 0; i < users.length; i++) {
        output += users[i] + "-> " + targets[users[i]] + "\n";
    }
    return output
}

function createChatElement(publicId, message, image) {
    var username = gameState.userList[publicId].username;
    var li = document.createElement('li');
    var span = document.createElement('span');
    span.innerText = username;

    span.classList.add("username");
    li.appendChild(span);
    paragraph = document.createElement('p');
    paragraph.innerText = message;
    li.appendChild(paragraph);
    if (image) {
        var blob = new Blob([image], { type: 'image/png' });
        var url = URL.createObjectURL(blob);
        var img = new Image;
        img.classList.add('message-image');
        img.src = url;
        li.appendChild(img);
    }
    document.getElementById('messages').appendChild(li);
}

function loadChatHistory(chatHistory) {
    //todo: save to indexdb
    for (var i = 0; i < chatHistory.length; i++) {
        var message = chatHistory[i];
        proccessMsg(message);
    }
}

function proccessMsg(msg){
    createChatElement(msg.publicId, msg.text, msg.image);
    if (msg.botMessage) {
        createChatElement('Gamebot3000', msg.botMessage);
    }
}

function markSnipe(event){
    //ui is a bit confusing, make clearer
    var isSnipe = document.getElementById('is-snipe').checked;
    if(isSnipe){
        document.getElementById('is-snipe').checked = false;
        document.getElementById("mark-snipe").innerText = "Snipe?"
    }else{
        document.getElementById('is-snipe').checked = true;
        document.getElementById("mark-snipe").innerText = "Sniped ✓"
    }
}

function deletePreview(){
    document.getElementById('photo-preview').hidden = true;
    document.getElementById('messages').hidden = false;
    document.getElementById('photo-input').value = '';
    document.getElementById('is-snipe').checked = false;
    document.getElementById("mark-snipe").innerText = "Snipe?"
    document.getElementById("mark-snipe").removeAttribute("disabled");
}

function cameraButton(event){
    document.getElementById('photo-input').click();
    event.preventDefault();
}

function photoInput(event){
    var img = document.getElementById('preview');
    img.src = URL.createObjectURL(event.target.files[0]);
    document.getElementById('photo-preview').hidden = false;
    document.getElementById('messages').hidden = true;
}

function sendMessage(ev){
    var file = document.getElementById('photo-input').files[0];
    message = {
        "text": document.getElementById('message').value,
        "image": file,
        "position": position,
        "isSnipe": document.getElementById('is-snipe').checked,
    }
    socket.emit('chat message', message);
    document.getElementById('message').value = '';
    document.getElementById('photo-input').value = '';
    document.getElementById('is-snipe').checked = false;
    document.getElementById("mark-snipe").innerText = "Snipe?"
    document.getElementById("mark-snipe").removeAttribute("disabled");
    document.getElementById('photo-preview').hidden = true;
    document.getElementById('messages').hidden = false;
    ev.preventDefault();
    return false;
}

function setCurrentTarget(){
    console.log(gameState.targets);
    var targetElement = document.getElementById('target');
    targetElement.innerText = "Target: " + gameState.userList[gameState.targets[publicId][0]].username;
}

var gameState;
const NOT_STARTED = "NOT STARTED";
const TARGETS_MADE = "TARGETS MADE";
const IN_PLAY = "IN PLAY";
const FINISHED = "FINISHED";

function updateTimeLeft(){
    document.getElementById('time-left').innerText = gameState.timeLeft / 1000;
}

// gameId needs to be decoded because it contains a '/'
// which gets URI encoded otherwise
const gameId = decodeURIComponent(document.cookie.replace(/(?:(?:^|.*;\s*)gameId\s*\=\s*([^;]*).*$)|^.*$/, "$1"));
console.log(gameId);
const privateId = document.cookie.replace(/(?:(?:^|.*;\s*)privateId\s*\=\s*([^;]*).*$)|^.*$/, "$1");
const publicId = document.cookie.replace(/(?:(?:^|.*;\s*)publicId\s*\=\s*([^;]*).*$)|^.*$/, "$1");

const socket = io(
    // leading slash is needed so IO nows we're giving it a path
    // otherwise it uses it as a domain
    `/${gameId}`,
    {
        query: {
            "privateId": privateId,
        }
    }
);

window.onload = function () {

    document.getElementById("mark-snipe").addEventListener('click', markSnipe);

    document.getElementById("delete-preview").addEventListener('click', deletePreview);

    document.getElementById("camera-button").addEventListener('click', cameraButton);

    document.getElementById('photo-input').addEventListener('change', photoInput);

    navigator.geolocation.watchPosition(
        updatePosition,
        dontUpdatePosition,
        { "enableHighAccuracy": true }
    );

    document.getElementById('send-message-form').addEventListener('submit', function (ev) {
        ev.preventDefault();
        return false;
    });
    document.getElementById('send-message').addEventListener('click', sendMessage);

    document.getElementById('make-targets').onclick = function (event) {
        var gameLength = document.getElementById('game-length').value;
        socket.emit('make targets', { gameLength: gameLength });
    }

    document.getElementById('start-game').onclick = function (event) {
        if(confirm('Start the game?')){
            socket.emit('start game');
        }
    }

    document.getElementById('stop-game').onclick = function (event) {
        if(confirm('Finish the game?')){
            socket.emit('stop game');
        }
    }

    function inPlayView(){
        updateTimeLeft();
        setCurrentTarget();
        document.getElementById('targets-made').hidden = true;
        document.getElementById('in-play').hidden = false;
        document.getElementById('time-left').innerText = gameState.timeLeft / 1000;
    }

    function targetsMadeView(){
        document.getElementById('targets-made').hidden = false;
        document.getElementById('not-started').hidden = true;
        console.log(targetDisplay(gameState.targets));

        var targetsElement = document.getElementById('target-list');
        targetsElement.innerHTML = '';
        var li = document.createElement('li');
        li.innerText = "Targets:";
        targetsElement.append(li);
        console.log(gameState.targets);
        for (var key of Object.keys(gameState.targets)) {
            var element = document.createElement('li');
            var text = gameState.userList[key].username + "->" + gameState.userList[gameState.targets[key][0]].username;
            element.innerText = text;
            targetsElement.appendChild(element);
        }
        document.getElementById('game-length-ro').value = gameState.gameLength / 1000;
    }

    function finishedView(winner, nextCode){
        if(gameState.userList[winner]){
            document.getElementById('game-result').innerText = gameState.userList[winner].username;
        }else{
            document.getElementById('game-result').innerText = winner;
        }
        console.log("dssd")
        var targetsState = document.getElementById('targets-state');
        for (var key of Object.keys(gameState.targets)) {
            var outerLi = document.createElement('li');
            var ul = document.createElement('ul');
            var innerLi = document.createElement('li');
            innerLi.innerText = gameState.userList[key].username
            outerLi.appendChild(innerLi);
            outerLi.appendChild(ul);
            var innerLi = document.createElement('li');
            //todo: map public ids to usernames
            innerLi.innerText = "got: " + gameState.targetsGot[key].map(x=> gameState.userList[x].username).join(" -> ");    
            ul.appendChild(innerLi);
            
            var innerLi = document.createElement('li');
            innerLi.innerText = "left: " + gameState.targets[key].map(x=> gameState.userList[x].username).join(" -> ");    
            ul.appendChild(innerLi);

            // var innerLi = document.createElement('li');
            // var got = document.createElement('p');
            // var text = gameState.userList[key].username + ":" + gameState.userList[gameState.targets[key][0]].username;
            // element.innerText = text;
            // targetsElement.appendChild(element);
            targetsState.appendChild(outerLi);
        }

        document.getElementById('finished').hidden = false;
        document.getElementById('in-play').hidden = true;

        var username = gameState.userList[publicId].username;
        document.getElementById('next-game-link').setAttribute('href', `/?code=${nextCode}&username=${username}`);
    }

    socket.on('initialization', function(msg){
        console.log('initialized');
        gameState = msg.gameState;
        console.log(gameState.state);

        loadChatHistory(msg.chatHistory);

        for (var element of document.getElementsByClassName('username')) {
            element.innerText = gameState.userList[publicId].username;
        }
        if(gameState.state == IN_PLAY){
            inPlayView();
        }else if(gameState.state == NOT_STARTED){
            document.getElementById('not-started').hidden = false;
            var userList = document.getElementById('user-list');
            userList.innerHTML = '';
            var li = document.createElement('li');
            li.innerText = "Players:";
            userList.append(li);
            for (const [index, user] of Object.entries(gameState.userList)) {
                var li = document.createElement('li');
                li.innerText = user.username;
                userList.append(li);
            }
        }else if(gameState.state == TARGETS_MADE){
            targetsMadeView();
        }else if(gameState.state == FINISHED){
            finishedView(gameState.winner, gameState.nextCode);
        }
    });

    socket.on('New user', function (msg) {
        gameState = msg.gameState;
        // msg needs to tell us which new user joined
        newUser = gameState.userList[msg.publicId].username;
        var userList = document.getElementById('user-list');
        var li = document.createElement('li');
        li.innerText = newUser;
        userList.append(li);
    });

    socket.on('make targets', function (msg) {
        gameState = msg.gameState;
        targetsMadeView();
    });

    socket.on('start', function (msg) {
        gameState = msg.gameState;
        inPlayView();
    });

    socket.on('game finished', function (msg) {
        finishedView(msg.winner, msg.nextCode);
    });

    socket.on('timeLeft', function (msg) {
        gameState = msg.gameState;
        updateTimeLeft();
    });

    socket.on('chat message', function (msg) {
        console.log(msg);
        gameState = msg.gameState;
        proccessMsg(msg);

        setCurrentTarget();

        //if we're scrolled to the bottom of messages, stick to the bottom
        messages = document.getElementById('messages')
        // if(messages.scrollTop == (messages.scrollHeight - messages.offsetHeight)){
        messages.scrollTo(0, messages.scrollHeight)
        // }
    });
};