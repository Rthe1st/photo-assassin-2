function testMode(){
    return location.hostname === "localhost" || location.hostname === "127.0.0.1";
}

var position = { latitude: null, longitude: null };

// try https://github.com/2gis/mock-geolocation
//set up timer, change the gps every X secondsa, to trigger the normal gps watcher
function mockCords(){
    position.latitude += (Math.random()-0.5)*0.0001;
    position.longitude += (Math.random()-0.5)*0.0001;
}

function updatePosition(geolocation) {
    if(testMode()){
        console.log("mock pos update");
        mockCords();
    }else{
        console.log("real pos update");
        position.latitude = geolocation.coords.latitude;
        position.longitude = geolocation.coords.longitude;
    }
    if(socket){
        socket.emit('positionUpdate', position);
    }
}
function dontUpdatePosition(a) {
    alert("geo faild");
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

function createChatElement(sender, message, image) {
    var li = document.createElement('li');
    var span = document.createElement('span');
    span.innerText = sender;

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
    createChatElement(gameState.userList[msg.publicId].username, msg.text, msg.image);
    if (msg.botMessage) {
        createChatElement('Gamebot3000', msg.botMessage);
    }
}

function deletePreview(){
    document.getElementById('photo-preview').hidden = true;
    document.getElementById('messages').hidden = false;
    document.getElementById('photo-input').value = '';
    document.getElementById('is-snipe').checked = false;
    document.getElementById("mark-snipe").innerText = "Snipe?"
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
    if (testMode()){
        mockCords();
    }
    console.log("position");
    console.log(position);
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

function updateTimeLeft(){
    document.getElementById('sub-state').innerText = gameState.subState;
    if(gameState.subState == "COUNTDOWN"){
        document.getElementById('time-left').innerText = (gameState.timeLeft - gameState.gameLength) / 1000;
    }else{
        document.getElementById('time-left').innerText = (gameState.timeLeft) / 1000;
    }
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

    function markSnipe(event){
        //dont think this needs to check game state
        // because if theres not game state the button will be hidden
        if(gameState && gameState.subState == "COUNTDOWN"){
            alert("Can't snipe yet - wait to countdown is over");
            return;
        }
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


    document.getElementById("mark-snipe").addEventListener('click', markSnipe);

    document.getElementById("delete-preview").addEventListener('click', deletePreview);

    document.getElementById("camera-button").addEventListener('click', cameraButton);

    document.getElementById('photo-input').addEventListener('change', photoInput);

    document.getElementById('send-message-form').addEventListener('submit', function (ev) {
        ev.preventDefault();
        return false;
    });
    document.getElementById('send-message').addEventListener('click', sendMessage);

    document.getElementById('make-targets').onclick = function (event) {
        if(confirm('Are you sure?')){
            var gameLength = document.getElementById('game-length').value;
            var countDown = document.getElementById('count-down').value;
            socket.emit('make targets', { gameLength: gameLength, countDown: countDown });
        }
    }

    document.getElementById('undo-make-targets').onclick = function (event) {
        if(confirm('Back to game setup?')){
            socket.emit('undo make targets');
        }
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
        document.getElementById('sub-state').innerText = gameState.subState;
        document.getElementById('time-left').innerText = gameState.timeLeft / 1000;
        //the first time, before they move
        if (testMode()){
            console.log("set fake start pos");
            position.latitude = 51.402129;
            position.longitude = -0.022835;
            console.log(position);
        }else{
            console.log("real start pos")
            navigator.geolocation.getCurrentPosition((position) => {
                updatePosition(position.coords.latitude, position.coords.longitude);
            });
        }

        navigator.geolocation.watchPosition(
            updatePosition,
            dontUpdatePosition,
            { "enableHighAccuracy": true, "maximumAge": 10000 }
        );
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
        document.getElementById('count-down-ro').value = gameState.countDown / 1000;
    }

    socket.on('initialization', function(msg){
        console.log('initialized');
        gameState = msg.gameState;
        console.log(gameState.state);
        // console.log(msg.chatHistory);
        loadChatHistory(msg.chatHistory);

        for (var element of document.getElementsByClassName('username')) {
            element.innerText = gameState.userList[publicId].username;
        }
        if(gameState.state == IN_PLAY){
            inPlayView();
        }else if(gameState.state == NOT_STARTED){
            document.getElementById('not-started').hidden = false;
            if(Object.entries(gameState.userList).length > 1){
                document.getElementById('make-targets').removeAttribute('disabled');
            }
            resetUserList(gameState.userList);
        }else if(gameState.state == TARGETS_MADE){
            targetsMadeView();
        }
    });

    function resetUserList(userList){
        var userListElement = document.getElementById('user-list');
        userListElement.innerHTML = '';
        var li = document.createElement('li');
        li.innerText = "Players:";
        userListElement.append(li);
        for (const [publicId, user] of Object.entries(userList)) {
            userListElement.append(createUserElement(user.username, publicId));
        }
    }

    function createUserElement(username, publicId){
        var li = document.createElement('li');
        var text = document.createElement('p');
        text.innerText = username;
        li.appendChild(text);
        var remove = document.createElement('button');
        remove.setAttribute('id', `delete-user-${publicId}`);
        remove.innerText = 'Remove';
        remove.onclick = function(){
            if(confirm(`Remove ${username} from the game?`)){
                socket.emit('remove user', { publicId: publicId });
            }
        }
        li.appendChild(remove);
        return li;
    }

    socket.on('New user', function (msg) {
        gameState = msg.gameState;
        if(Object.entries(gameState.userList).length > 1){
            document.getElementById('make-targets').removeAttribute('disabled');
        }
        newUser = gameState.userList[msg.publicId].username;
        var userList = document.getElementById('user-list');
        userList.append(createUserElement(newUser, msg.publicId));
    });

    socket.on('Remove user', function(msg){
        gameState = msg.gameState;
        console.log(gameState.userList);
        resetUserList(gameState.userList);
        if(publicId == msg.publicId){
            //delete our cookie and reload
            // so we look like a brandnew user
            document.cookie = name+'=; Max-Age=-99999999;';
            location.reload(true);
        }
    });

    socket.on('make targets', function (msg) {
        gameState = msg.gameState;
        targetsMadeView();
    });

    socket.on('undo make targets', function (msg) {
        gameState = msg.gameState;
        //reseting values isn't needed
        // because they should already be in their from the make-targets message
        document.getElementById('game-length').value = gameState.gameLength /1000;
        document.getElementById('count-down').value = gameState.countDown /1000;
        document.getElementById('targets-made').hidden = true;
        document.getElementById('not-started').hidden = false;
    });

    socket.on('start', function (msg) {
        gameState = msg.gameState;
        inPlayView();
    });

    socket.on('game finished', function (msg) {
        location.reload(true);
    });

    socket.on('timeLeft', function (msg) {
        gameState = msg.gameState;
        if(msg.countDownOver){
            //update screen to show in play mode
        }
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