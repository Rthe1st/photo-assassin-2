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

function createChatElement(username, message, image) {
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

function loadChatHistory(gameId) {
    var gameChatStorage = window.localStorage.getItem(gameId);
    gameChatStorage = JSON.parse(gameChatStorage);
    console.log(gameChatStorage);
    if (gameChatStorage) {
        for (var i = 0; i < gameChatStorage.length; i++) {
            createChatElement(gameChatStorage[i]["username"], gameChatStorage[i]["message"]);
        }
    }
}

function newMessageEntry(gameId, username, message, image) {
    createChatElement(username, message, image);

    //todo: save server side as well
    //todo: work out how to deal with images better
    // without blowing storage limit
    //todo: when we're close to limit, kick out old messages
    var gameChatStorage = window.localStorage.getItem(gameId);
    if (gameChatStorage == null) {
        gameChatStorage = [];
    } else {
        gameChatStorage = JSON.parse(gameChatStorage);
    }
    gameChatStorage.push({ "username": username, "message": message });
    window.localStorage.setItem(gameId, JSON.stringify(gameChatStorage));
}

window.onload = function () {

    document.getElementById("mark-snipe").addEventListener('click', function (ev) {
        document.getElementById('is-snipe').checked = true;
        document.getElementById("mark-snipe").innerText = "Sniped ✓"
        document.getElementById("mark-snipe").setAttribute("disabled", "");
        ev.preventDefault();
    });

    document.getElementById("delete-preview").addEventListener('click', function (ev) {
        document.getElementById('photo-preview').hidden = true;
        document.getElementById('messages').hidden = false;
        document.getElementById('photo-input').value = '';
        document.getElementById('is-snipe').checked = false;
        document.getElementById("mark-snipe").innerText = "Snipe?"
        document.getElementById("mark-snipe").removeAttribute("disabled");
        ev.preventDefault();
    });

    document.getElementById("camera-button").addEventListener('click', function (ev) {
        document.getElementById('photo-input').click();
        ev.preventDefault();
    });

    document.getElementById('photo-input').addEventListener('change', function (event) {
        var img = document.getElementById('preview');
        img.src = URL.createObjectURL(event.target.files[0]);
        document.getElementById('photo-preview').hidden = false;
        document.getElementById('messages').hidden = true;
    });

    navigator.geolocation.watchPosition(
        updatePosition,
        dontUpdatePosition,
        { "enableHighAccuracy": true }
    );

    // gameId needs to be decoded because it contains a '/'
    // which gets URI encoded otherwise
    var gameId = decodeURIComponent(document.cookie.replace(/(?:(?:^|.*;\s*)gameId\s*\=\s*([^;]*).*$)|^.*$/, "$1"));
    var privateId = document.cookie.replace(/(?:(?:^|.*;\s*)privateId\s*\=\s*([^;]*).*$)|^.*$/, "$1");
    var publicId = document.cookie.replace(/(?:(?:^|.*;\s*)publicId\s*\=\s*([^;]*).*$)|^.*$/, "$1");
    console.log(gameId);

    loadChatHistory(gameId);

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
    document.getElementById('send-message-form').addEventListener('submit', function (ev) {
        ev.preventDefault();
        return false;
    });
    document.getElementById('send-message').addEventListener('click', function (ev) {
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
    });

    function processGameStateChange(gameState) {
        // this really only needs to be done once when we first recieve game state
        for (var element of document.getElementsByClassName('username')) {
            element.innerText = gameState.userList[publicId].username;
        }
        //console.log(gameState);
        if (gameState.state == TARGETS_MADE) {
            document.getElementById('targets-made').hidden = false;
            document.getElementById('not-started').hidden = true;
            document.getElementById('in-play').hidden = true;
            document.getElementById('send-message-form').hidden = true;
            document.getElementById('messages').hidden = true;
            document.getElementById('user-list').hidden = false;
            console.log(targetDisplay(gameState.targets));

            var targetsElement = document.getElementById('user-list');
            targetsElement.innerHTML = '';
            for (var key of Object.keys(gameState.targets)) {
                var element = document.createElement('li');
                var text = gameState.userList[key].username + "->" + gameState.userList[gameState.targets[key]].username;
                element.innerText = text;
                targetsElement.appendChild(element);
            }
        }
        if (gameState.state == NOT_STARTED) {
            document.getElementById('targets-made').hidden = true;
            document.getElementById('not-started').hidden = false;
            document.getElementById('in-play').hidden = true;
            document.getElementById('send-message-form').hidden = true;
            document.getElementById('messages').hidden = true;
            document.getElementById('user-list').hidden = false;
            document.getElementById('photo-preview').hidden = true;
            console.log("winner was " + gameState.winner);
        }
        if (gameState.state == IN_PLAY) {
            document.getElementById('mark-snipe').hidden = false;
            document.getElementById('targets-made').hidden = true;
            document.getElementById('not-started').hidden = true;
            document.getElementById('in-play').hidden = false;
            if (document.getElementById('photo-preview').hidden) {
                document.getElementById('messages').hidden = false;
                document.getElementById('user-list').hidden = true;
                document.getElementById('send-message-form').hidden = false;
            }
            // console.log("time left: " + gameState.timeLeft/1000);
            var targetElement = document.getElementById('target');
            targetElement.innerText = "Target: " + gameState.userList
            [gameState.targets[publicId]].username;
            document.getElementById('time-left').innerText = gameState.timeLeft / 1000;
        } else {
            document.getElementById('mark-snipe').hidden = true;
        }
    }

    var gameState;
    var NOT_STARTED = "NOT STARTED";
    var TARGETS_MADE = "TARGETS MADE";
    var IN_PLAY = "IN PLAY";

    document.getElementById('make-targets').onclick = function (event) {
        socket.emit('make targets');
    }

    document.getElementById('start-game').onclick = function (event) {
        var gameLength = document.getElementById('game-length').value;
        socket.emit('start game', { gameLength: gameLength });
    }

    document.getElementById('stop-game').onclick = function (event) {
        // todo: add confirmation dialogue
        document.getElementById('photo-input').value = '';
        socket.emit('stop game');
    }

    socket.on('game finished', function (msg) {
        // todo: set the username to current one
        document.getElementById('next-game-link').setAttribute('href', `/game/${msg.nextGameCode}`);
        document.getElementById('game-result').innerText = msg.winner;
        document.getElementById('finished').hidden = false;
        document.getElementById('targets-made').hidden = true;
        document.getElementById('not-started').hidden = true;
        document.getElementById('in-play').hidden = true;
        document.getElementById('send-message-form').hidden = true;
        document.getElementById('messages').hidden = true;
        document.getElementById('user-list').hidden = true;
        document.getElementById('photo-preview').hidden = true;

    });

    socket.on('update state', function (msg) {
        gameState = msg.gameState;
        processGameStateChange(gameState);
        if (msg.botMessage) {
            newMessageEntry(gameId, 'Gamebot3000', msg.botMessage);
        }
    });

    socket.on('New user', function (msg) {
        gameState = msg.gameState;
        // msg needs to tell us which new user joined
        newUser = gameState.userList[msg.publicId].username;
        // newMessageEntry(gameId, 'Gamebot3000', 'New user joined: ' + newUser);
        processGameStateChange(gameState);
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
    });

    socket.on('timeLeft', function (msg) {
        gameState = msg.gameState;
        processGameStateChange(gameState);
    });

    socket.on('chat message', function (msg) {
        console.log(msg);
        gameState = msg.gameState;
        username = gameState.userList[msg.publicId].username;
        newMessageEntry(gameId, username, msg.text, msg.image)
        processGameStateChange(gameState);

        if (msg.botMessage) {
            newMessageEntry(gameId, 'Gamebot3000', msg.botMessage);
        }

        //if we're scrolled to the bottom of messages, stick to the bottom
        messages = document.getElementById('messages')
        // if(messages.scrollTop == (messages.scrollHeight - messages.offsetHeight)){
        messages.scrollTo(0, messages.scrollHeight)
        // }
    });
    // var photo = document.getElementById('photo');
};