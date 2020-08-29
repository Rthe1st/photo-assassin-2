import * as gps from './gps'
import * as game from './game'
import * as socketEvents from './socketEvents'

import * as Sentry from '@sentry/browser';
import { shuffle } from './shuffle';

Sentry.init({ dsn: process.env.BROWSER_SENTRY });
if(process.env.SENTRY_TESTS == "true"){
    Sentry.captureException(new Error("sentry test in index.js"));
}
function createChatElement(sender, message, image, snipeNumber, snipePlayer, snipeCount) {
    var li = document.createElement('li');
    li.setAttribute('class', 'message-li');
    var span = document.createElement('span');
    span.innerText = sender;

    span.classList.add("username");
    li.appendChild(span);
    let paragraph = document.createElement('p');
    paragraph.innerText = message;
    li.appendChild(paragraph);
    if (image) {
        var blob = new Blob([image], { type: 'image/png' });
        var url = URL.createObjectURL(blob);
        var img = new Image;
        img.classList.add('message-image');
        img.src = url;
        li.appendChild(img);
        if(snipePlayer){
            img.setAttribute('id', `snipe-${snipePlayer}-${snipeNumber}-${snipeCount}`)
            var voteButton = document.createElement('button');
            voteButton.innerText = 'vote';
            voteButton.onclick = function(){
                socketEvents.badSnipe(socket, snipeNumber, snipePlayer);
            };
            li.appendChild(voteButton);
        }
    }
    document.getElementById('messages').appendChild(li);
}

function processMsg(msg){
    if (msg.botMessage) {
        createChatElement('Gamebot3000', msg.botMessage);
    }
    //todo: you can actual work out snipe number ,player, snipecount from game state
    // if game state is upto date
    createChatElement(game.getUsername(msg.publicId), msg.text, msg.image, msg.snipeNumber, msg.snipePlayer, msg.snipeCount);
    if(publicId == game.getLastSnipedPlayerId(msg.publicId)){
        showSnipedScreen(msg.botMessage);
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
    let message = {
        "text": document.getElementById('message').value,
        "image": file,
        "position": gps.position,
        "isSnipe": document.getElementById('is-snipe').checked,
    }
    socketEvents.chatMessage(socket, message);
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
    var targetElement = document.getElementById('target');
    targetElement.innerText = "Target: " + game.getTarget(publicId);
}

function updateTimeLeft(){
    document.getElementById('sub-state').innerText = game.game.subState;
    document.getElementById('time-left').innerText = game.timeLeft();
}

function markSnipe(event){
    //dont think this needs to check game state
    // because if theres not game state the button will be hidden
    if(game.game.subState == game.inPlaySubStates.COUNTDOWN){
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

function inPlayView(){
    updateTimeLeft();
    setCurrentTarget();
    document.getElementById('targets-made').hidden = true;
    document.getElementById('in-play').hidden = false;
    document.getElementById('sub-state').innerText = game.game.subState;
    document.getElementById('time-left').innerText = game.game.timeLeft / 1000;

    //the first time, before they move
    gps.setup((position) => socketEvents.positionUpdate(socket, position));
}

function targetsMadeView(){
    document.getElementById('targets-made').hidden = false;
    document.getElementById('not-started').hidden = true;

    var targetsElement = document.getElementById('target-list');
    targetsElement.innerHTML = '';
    var li = document.createElement('li');
    li.innerText = "Targets:";
    targetsElement.append(li);
    for (var [sniper, target] of game.getTargetPairs()) {
        var element = document.createElement('li');
        var text = `${sniper} -> ${target}`;
        element.innerText = text;
        targetsElement.appendChild(element);
    }
    document.getElementById('game-length-ro').value = game.game.gameLength / 1000;
    document.getElementById('count-down-ro').value = game.game.countDown / 1000;
}

function markSnipesAsBad(undoneSnipes){
    for(var snipeId of undoneSnipes){
        //bug:snipe, undo, snipe, undo, reload page
        // only 2nd snipe marked as undone
        let snipeImage = document.getElementById(`snipe-${snipeId}`);
        if(!document.getElementById(`snipe-text-${snipeId}`)){
            var undotext = document.createElement('p');
            undotext.innerText = "BAD SNIPE";
            undotext.setAttribute('class', 'undotext');
            undotext.setAttribute('id', `snipe-text-${snipeId}`);
            snipeImage.parentNode.appendChild(undotext);
            snipeImage.parentNode.getElementsByTagName('button')[0].hidden = true;
        }
    }
}

function refreshProposedTargets(){
    let targetList = document.getElementById('proposed-target-list');
    targetList.innerHTML = '';
    var li = document.createElement('li');
    li.innerText = "Targets:";
    targetList.append(li);
    for (var [sniper, target] of game.getProposedTargetPairs(proposedTargetList)){
        var element = document.createElement('li');
        var text = `${sniper} -> ${target}`;
        element.innerText = text;
        targetList.appendChild(element);
    }
}

function initialization(msg){
    console.log('initialized');
    game.update(msg.gameState);
    for (let message of msg.chatHistory) {
        processMsg(message);
    }
    markSnipesAsBad(game.game.undoneSnipes);
    for (var element of document.getElementsByClassName('username')) {
        element.innerText = game.getUsername(publicId);
    }
    if(game.game.state == game.states.IN_PLAY){
        inPlayView();
    }else if(game.game.state == game.states.NOT_STARTED){
        proposedTargetList = msg.gameState.chosenSettings.proposedTargetList;
        document.getElementById('not-started').hidden = false;
        refreshProposedTargets();
        // todo: move into game as isGameReady()
        if(Object.entries(game.game.userList).length > 1){
            document.getElementById('make-targets').removeAttribute('disabled');
        }
        resetUserList(game.game.userList);
    }else if(game.game.state == game.states.TARGETS_MADE){
        targetsMadeView();
    }
};

function badSnipe(msg){
    game.update(msg.gameState);
    setCurrentTarget();
    //go through msg history and mark delete snipes as gone
    markSnipesAsBad(game.game.undoneSnipes);
    //good to know what snipes go undone in this event so we can show user
    console.log(msg.snipePlayer + "had to undo " +msg.undoneSnipes);
}

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
            socketEvents.removeUser(socket, publicId);
        }
    }
    li.appendChild(remove);
    return li;
}

function newUser(msg) {
    game.update(msg.gameState);
    proposedTargetList = game.getSettings().proposedTargetList;
    refreshProposedTargets();
    if(Object.entries(game.game.userList).length > 1){
        document.getElementById('make-targets').removeAttribute('disabled');
    }
    newUser = game.getUsername(msg.publicId);
    var userList = document.getElementById('user-list');
    userList.append(createUserElement(newUser, msg.publicId));
};

function removeUser(msg){
    game.update(msg.gameState);
    proposedTargetList = game.getSettings().proposedTargetList;
    refreshProposedTargets();
    resetUserList(game.game.userList);
    if(publicId == msg.publicId){
        //delete our cookie and reload
        // so we look like a brandnew user
        document.cookie = name+'=; Max-Age=-99999999;';
        location.reload(true);
    }
};

function makeTargets(msg) {
    game.update(msg.gameState);
    targetsMadeView();
};

function undoMakeTargets(msg) {
    game.update(msg.gameState);
    //resetting values isn't needed
    // because they should already be in their from the make-targets message
    document.getElementById('game-length').value = game.getSettings().gameLength /1000;
    document.getElementById('count-down').value = game.getSettings().countDown /1000;
    document.getElementById('targets-made').hidden = true;
    document.getElementById('not-started').hidden = false;
    proposedTargetList = game.getSettings().proposedTargetList;
    refreshProposedTargets();
};

function start(msg) {
    game.update(msg.gameState);
    inPlayView();
};

function finished() {
    location.reload(true);
};

function timeLeft(msg) {
    game.update(msg.gameState);
    updateTimeLeft();
};

function chatMessage(msg) {
    game.update(msg.gameState);
    processMsg(msg);

    setCurrentTarget();

    //if we're scrolled to the bottom of messages, stick to the bottom
    let messages = document.getElementById('messages');
    // if(messages.scrollTop == (messages.scrollHeight - messages.offsetHeight)){
    messages.scrollTo(0, messages.scrollHeight)
    // }
};

function shuffleTargets(){
    proposedTargetList = shuffle(proposedTargetList);
    refreshProposedTargets();
}

function hideSnipedScreen(){
    let snipeScreen = document.getElementById('sniped-screen');
    let messages = document.getElementById('messages');
    let sendMessageForm = document.getElementById('send-message-form');
    let inPlayTop = document.getElementById('in-play').getElementsByClassName('top')[0];
    messages.hidden = false;
    sendMessageForm.hidden = false;
    inPlayTop.hidden = false;
    snipeScreen.hidden = true;
}

function showSnipedScreen(msg){
    let snipeScreen = document.getElementById('sniped-screen');
    let messages = document.getElementById('messages');
    let sendMessageForm = document.getElementById('send-message-form');
    let inPlayTop = document.getElementById('in-play').getElementsByClassName('top')[0];
    messages.hidden = true;
    sendMessageForm.hidden = true;
    inPlayTop.hidden = true;
    snipeScreen.hidden = false;
    document.getElementById('sniped-alert-text').innerText = msg;
    var successBool = window.navigator.vibrate([10]);
}

function showGameInfo(){
    let gameInfoDiv = document.getElementById('game-info');
    let messages = document.getElementById('messages');
    let sendMessageForm = document.getElementById('send-message-form')
    if(gameInfoDiv.hidden){
        gameInfoDiv.hidden = false;
        sendMessageForm.hidden = true;
        messages.hidden = true;
        let playerProgressList = document.getElementById('player-progress');
        playerProgressList.innerHTML = '';
        for (const [publicId, user] of Object.entries(game.game.userList)) {
            let playerElement = document.createElement('li');
            let [got, remaining] = game.getPlayerProgress(publicId);
            playerElement.innerText = user.username + ", target: " + game.getTarget(publicId) + ', ' + got + '/' + remaining;
            playerProgressList.appendChild(playerElement);
        }
    }else{
        gameInfoDiv.hidden = true;
        sendMessageForm.hidden = false;
        messages.hidden = false;
    }
}

// gameId needs to be decoded because it contains a '/'
// which gets URI encoded otherwise
const gameId = decodeURIComponent(document.cookie.replace(/(?:(?:^|.*;\s*)gameId\s*\=\s*([^;]*).*$)|^.*$/, "$1"));
console.log(gameId);
const privateId = document.cookie.replace(/(?:(?:^|.*;\s*)privateId\s*\=\s*([^;]*).*$)|^.*$/, "$1");
const publicId = document.cookie.replace(/(?:(?:^|.*;\s*)publicId\s*\=\s*([^;]*).*$)|^.*$/, "$1");

let socket;
let proposedTargetList;

window.onload = function () {

    // do in onload, so that we can't accidentally receive a socket event
    // before dom loaded
    socket = socketEvents.setup(
        gameId,
        privateId,
        initialization,
        badSnipe,
        newUser,
        removeUser,
        makeTargets,
        undoMakeTargets,
        start,
        finished,
        timeLeft,
        chatMessage
    );

    document.getElementById("exit-sniped-screen").addEventListener('click', hideSnipedScreen);

    document.getElementById("show-game-info").addEventListener('click', showGameInfo);

    document.getElementById("shuffle-targets").addEventListener('click', shuffleTargets);

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
            socketEvents.makeTargets(socket, gameLength, countDown, proposedTargetList);
        }
    }

    document.getElementById('undo-make-targets').onclick = function (event) {
        if(confirm('Back to game setup?')){
            socketEvents.undoMakeTargets(socket);
        }
    }

    document.getElementById('start-game').onclick = function (event) {
        if(confirm('Start the game?')){
            socketEvents.startGame(socket);
        }
    }

    document.getElementById('stop-game').onclick = function (event) {
        if(confirm('Finish the game?')){
            socketEvents.stopGame(socket);
        }
    }
};