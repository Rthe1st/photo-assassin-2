import * as gps from './gps'
import * as game from './game'
import * as SharedGame from '../shared/game'
import * as socketClient from './socketClient'

import * as Sentry from '@sentry/browser';
import { shuffle } from '../shared/shuffle';

Sentry.init({ dsn: process.env.BROWSER_SENTRY });
if (process.env.SENTRY_TESTS == "true") {
    Sentry.captureException(new Error("sentry test in index.js"));
}
function createChatElement(sender: string, message: string, imageId?: number, snipeInfo?: SharedGame.SnipeInfo) {
    var li = document.createElement('li');
    let messages = document.getElementById('messages')!
    messages.appendChild(li);
    let previousMessage = messages.lastElementChild!;
    let previousSender;
    if (previousMessage.getElementsByTagName('span').length > 0) {
        // todo: get this from gamestate instead
        previousSender = previousMessage.getElementsByTagName('span')[0].innerText;
    }
    if (game.getUsername(publicId) == sender) {
        li.setAttribute('class', 'own-message');
    } else if (previousSender != sender) {
        //only show username if previous message was from someone else
        li.setAttribute('class', 'message-li');
        var span = document.createElement('span');
        span.innerText = sender;
        span.classList.add("username");
        li.appendChild(span);
    }
    if (message != '') {
        let paragraph = document.createElement('p');
        paragraph.innerText = message;
        li.appendChild(paragraph);
    }
    if (imageId != undefined) {
        var img = new Image;
        img.classList.add('message-image');
        img.src = window.location.href + `/images/${imageId}`;
        li.appendChild(img);
        if (snipeInfo != undefined) {
            img.setAttribute('id', `snipe-${snipeInfo.index}`)
            var voteButton = document.createElement('button');
            voteButton.setAttribute('class', 'vote-button')
            let targetUser = game.getUsername(snipeInfo.target);
            voteButton.innerText = `Was ${targetUser} not in the picture?`;
            voteButton.onclick = function () {
                if (confirm(`Was ${targetUser} not in the picture?`)) {
                    let msg: socketClient.ClientBadSnipe = {
                        snipeInfosIndex: snipeInfo.index
                    }
                    socketClient.badSnipe(socket, msg);
                    voteButton.onclick = null;
                    voteButton.disabled = true;
                }
            };
            li.appendChild(voteButton);
            if(snipeInfo.undone){
                markSnipeAsBad(snipeInfo.index);
            }
        }
    }
}

function processMsg(msg: socketClient.ServerChatMessage, isReplay: boolean) {
    if (msg.botMessage) {
        createChatElement('Gamebot3000', msg.botMessage);
    }
    createChatElement(game.getUsername(msg.publicId), msg.text, msg.imageId, msg.snipeInfo);
    if (isReplay) {
        return;
    }
    if (publicId == game.getLastSnipedPlayerId(msg.publicId)) {
        showSnipedScreen(game.getUsername(msg.publicId) + " sniped you!");
    }
}

function deletePreview() {
    document.getElementById('photo-preview')!.hidden = true;
    document.getElementById('main-in-play')!.hidden = false;
    (<HTMLInputElement>document.getElementById('photo-input')).value = '';
    (<HTMLInputElement>document.getElementById('is-snipe')).checked = false;
    document.getElementById("mark-snipe-question")!.innerText = "Is your target in the picture?";
    document.getElementById("mark-snipe")!.innerText = "Yes";
    document.getElementById("mark-not-snipe")!.innerText = "No ✓";
    (<HTMLImageElement>document.getElementById('preview')).src = '/static/shitty_loader.jpg';
}

function cameraButton(event: MouseEvent) {
    document.getElementById('photo-input')!.click();
    (<HTMLImageElement>document.getElementById('preview')).src = '/static/shitty_loader.jpg';
    event.preventDefault();
}

function photoInput(event: Event) {
    document.getElementById('photo-preview')!.hidden = false;
    document.getElementById('main-in-play')!.hidden = true;
    (<HTMLInputElement>document.getElementById('photo-message')).value = (<HTMLInputElement>document.getElementById('message')).value;
    let img = (<HTMLImageElement>document.getElementById('preview'));
    //todo: can a change event leave files undefined?
    img.src = URL.createObjectURL((<HTMLInputElement>event.target).files![0]);
    let target = game.getTarget(publicId);
    document.getElementById("mark-snipe-question")!.innerText = `Is ${target} in the picture?`
}

function sendTextMessage(ev: MouseEvent) {
    let messageElement = <HTMLInputElement>document.getElementById('message');
    if (messageElement.value == '') {
        return;
    }
    let message: socketClient.ClientChatMessage = {
        text: messageElement.value,
        position: gps.position,
        image: undefined,
        isSnipe: undefined
    }
    socketClient.chatMessage(socket, message);
    messageElement.value = '';
    ev.preventDefault();
    // keep the keyboard open, incase user wants to send another message
    document.getElementById('message')!.focus();
    return false;
}

function sendPhotoMessage(ev: MouseEvent) {
    var file: File = (<HTMLInputElement>document.getElementById('photo-input')).files![0];

    let message = {
        "text": (<HTMLInputElement>document.getElementById('photo-message')).value,
        "image": file,
        "position": gps.position,
        "isSnipe": (<HTMLInputElement>document.getElementById('is-snipe')).checked,
    }
    socketClient.chatMessage(socket, message);
    (<HTMLInputElement>document.getElementById('message')).value = '';
    (<HTMLInputElement>document.getElementById('photo-message')).value = '';
    (<HTMLInputElement>document.getElementById('photo-input')).value = '';
    (<HTMLInputElement>document.getElementById('is-snipe')).checked = false;
    document.getElementById("mark-snipe")!.innerText = "Yes";
    document.getElementById("mark-not-snipe")!.innerText = "No ✓";
    document.getElementById('photo-preview')!.hidden = true;
    document.getElementById('main-in-play')!.hidden = false;
    ev.preventDefault();
    return false;
}

function setCurrentTarget() {
    var targetElement = document.getElementById('target')!;
    targetElement.innerText = game.getTarget(publicId, undefined);
}

function updateTimeLeft() {
    (<HTMLParagraphElement>document.getElementById('sub-state')!).innerText = game.game.subState!;
    (<HTMLParagraphElement>document.getElementById('time-left')!).innerText = String(game.timeLeft());
}

function setSnipe(unset: boolean) {
    // ui is a bit confusing, make clearer
    var isSnipe = <HTMLInputElement>document.getElementById('is-snipe');
    if (unset) {
        isSnipe.checked = false;
        document.getElementById("mark-snipe")!.innerText = "Yes";
        document.getElementById("mark-not-snipe")!.innerText = "No ✓";
    } else {
        isSnipe.checked = true;
        document.getElementById("mark-snipe")!.innerText = "Yes ✓";
        document.getElementById("mark-not-snipe")!.innerText = "No";
    }
}

function markNotSnipe(_: MouseEvent) {
    //dont think this needs to check game state
    // because if theres not game state the button will be hidden
    if (game.game.subState == game.inPlaySubStates.COUNTDOWN) {
        alert("Can't snipe yet - wait to countdown is over");
        return;
    }
    setSnipe(true);
}

function markSnipe(_: MouseEvent) {
    //dont think this needs to check game state
    // because if theres not game state the button will be hidden
    if (game.game.subState == game.inPlaySubStates.COUNTDOWN) {
        alert("Can't snipe yet - wait to countdown is over");
        return;
    }
    setSnipe(false);
}

function inPlayView() {
    updateTimeLeft();
    setCurrentTarget();
    document.getElementById('not-started')!.hidden = true;
    document.getElementById('in-play')!.hidden = false;
    document.getElementById('sub-state')!.innerText = game.game.subState!;
    (<HTMLParagraphElement>document.getElementById('time-left')).innerText = String(game.game.timeLeft! / 1000);

    //the first time, before they move
    gps.setup((position) => socketClient.positionUpdate(socket, position));
}

function targetsMadeView() {
    refreshProposedTargets(game.getSettings().proposedTargetList);
    document.getElementById('make-targets')!.removeAttribute('disabled');
    document.getElementById('make-targets')!.innerText = "Start";
    document.getElementById('undo-make-targets')!.hidden = false;
    (<HTMLInputElement>document.getElementById('game-length')).value = String(game.game.gameLength! / 1000 / 60);
    document.getElementById('game-length')!.setAttribute('readonly', '');
    document.getElementById('game-length')!.setAttribute('class', 'look-disabled');
    (<HTMLInputElement>document.getElementById('count-down')).value = String(game.game.countDown! / 1000 / 60);
    document.getElementById('count-down')!.setAttribute('readonly', '');
    document.getElementById('count-down')!.setAttribute('class', 'look-disabled');
    (<HTMLButtonElement>document.getElementById('shuffle-targets')).disabled = true;
    resetUserList(game.game.userList);
    let deleteButtons = document.getElementsByClassName('delete-user-button');
    for (let i = 0; i < deleteButtons.length; i++) {
        (<HTMLButtonElement>deleteButtons[i]).disabled = true;
    }
}

function markSnipeAsBad(snipeInfosIndex: number) {
    let snipeImage = document.getElementById(`snipe-${snipeInfosIndex}`)!;
    if (!document.getElementById(`snipe-text-${snipeInfosIndex}`)) {
        var undotext = document.createElement('p');
        undotext.innerText = "BAD SNIPE";
        undotext.setAttribute('class', 'undotext');
        undotext.setAttribute('id', `snipe-text-${snipeInfosIndex}`);
        snipeImage.parentNode!.appendChild(undotext);
        (<HTMLButtonElement>(<Element>snipeImage.parentNode).getElementsByTagName('button')[0]).hidden = true;
    }
}

function refreshProposedTargets(proposedTargetList: number[]) {
    let targetList = document.getElementById('proposed-target-list')!;
    targetList.innerHTML = '';
    for (var [sniper, target] of game.getProposedTargetPairs(proposedTargetList)) {
        var element = document.createElement('li');
        var text = `${sniper} -> ${target}`;
        element.innerText = text;
        targetList.appendChild(element);
    }
}

function initialization(msg: socketClient.ServerInitializationMsg) {
    console.log('initialized');
    game.update(msg.gameState);
    for (let message of msg.chatHistory) {
        processMsg(message, true);
    }
    let userNameElements = document.getElementsByClassName('current-username');
    for (let index = 0; index < userNameElements.length; index++) {
        (<HTMLElement>userNameElements[index]).innerText = game.getUsername(publicId);
    }
    if (game.game.state == game.states.IN_PLAY) {
        inPlayView();
    } else if (game.game.state == game.states.NOT_STARTED) {
        proposedTargetList = game.getSettings().proposedTargetList;
        document.getElementById('not-started')!.hidden = false;
        document.getElementById('undo-make-targets')!.hidden = true;
        refreshProposedTargets(proposedTargetList);
        // todo: move into game as isGameReady()
        if (Object.entries(game.game.userList).length > 1) {
            document.getElementById('make-targets')!.removeAttribute('disabled');
        }
        resetUserList(game.game.userList);
        let deleteButtons = document.getElementsByClassName('delete-user-button');
        for (let i = 0; i < deleteButtons.length; i++) {
            (<HTMLButtonElement>deleteButtons[i]).hidden = false;
        }
    } else if (game.game.state == game.states.TARGETS_MADE) {
        document.getElementById('not-started')!.hidden = false;
        targetsMadeView();
    }
};

function badSnipe(msg: socketClient.ServerBadSnipeMsg) {
    game.update(msg.gameState);
    setCurrentTarget();
    for(let snipeInfoIndex of msg.undoneSnipeIndexes){
        markSnipeAsBad(snipeInfoIndex);
    }
}

function resetUserList(userList: SharedGame.UserList) {
    var userListElement = document.getElementById('user-list')!;
    userListElement.innerHTML = '';
    for (const [publicId, user] of Object.entries(userList)) {
        userListElement.append(createUserElement(user['username'], parseInt(publicId)));
    }
}

function createUserElement(username: string, publicId: number) {
    var li = document.createElement('li');
    li.setAttribute('class', 'user-info-area')
    var text = document.createElement('p');
    text.setAttribute('class', 'user-joined-text')
    text.innerText = username;
    li.appendChild(text);
    var remove = document.createElement('button');
    remove.setAttribute('id', `delete-user-${publicId}`);
    remove.setAttribute('class', 'delete-user-button')
    remove.innerText = 'Remove';
    remove.onclick = function () {
        if (confirm(`Remove ${username} from the game?`)) {
            socketClient.removeUser(socket, publicId);
        }
    }
    li.appendChild(remove);
    return li;
}

function newUser(msg: socketClient.NewUserMsg) {
    game.update(msg.gameState);
    proposedTargetList = game.getSettings().proposedTargetList;
    refreshProposedTargets(proposedTargetList);
    if (Object.entries(game.game.userList).length > 1) {
        document.getElementById('make-targets')!.removeAttribute('disabled');
    }
    let newUser = game.getUsername(msg.publicId);
    var userList = document.getElementById('user-list')!;
    userList.append(createUserElement(newUser, msg.publicId));
};

function removeUser(msg: socketClient.RemoveUserMsg) {
    game.update(msg.gameState);
    proposedTargetList = game.getSettings().proposedTargetList;
    refreshProposedTargets(proposedTargetList);
    resetUserList(game.game.userList);
    if (publicId == msg.publicId) {
        //delete our cookie and reload
        // so we look like a brandnew user
        document.cookie = name + '=; Max-Age=-99999999;';
        location.reload(true);
    }
};

function makeTargets(msg: socketClient.ServerMakeTargetsMsg) {
    game.update(msg.gameState);
    targetsMadeView();
};

function undoMakeTargets(msg: socketClient.ServerUndoMakeTargetsMsg) {
    game.update(msg.gameState);
    //resetting values isn't needed
    // because they should already be in their from the make-targets message
    (<HTMLInputElement>document.getElementById('game-length')).value = String(game.getSettings().gameLength! / 1000 / 60);
    (<HTMLInputElement>document.getElementById('count-down')).value = String(game.getSettings().countDown! / 1000 / 60);
    document.getElementById('undo-make-targets')!.hidden = true;
    document.getElementById('game-length')!.removeAttribute('readonly');
    document.getElementById('game-length')!.removeAttribute('class');
    document.getElementById('count-down')!.removeAttribute('readonly');
    document.getElementById('count-down')!.removeAttribute('class');
    (<HTMLButtonElement>document.getElementById('shuffle-targets')).disabled = false;
    document.getElementById('make-targets')!.innerText = "Lock settings?";
    let deleteButtons = document.getElementsByClassName('delete-user-button');
    for (let i = 0; i < deleteButtons.length; i++) {
        (<HTMLButtonElement>deleteButtons[i]).disabled = false;
    }

    proposedTargetList = game.getSettings().proposedTargetList;
    refreshProposedTargets(proposedTargetList);
};

function start(msg: socketClient.ServerStartMsg) {
    game.update(msg.gameState);
    inPlayView();
};

function finished() {
    location.reload(true);
};

function timeLeft(msg: socketClient.ServerTimeLeftMsg) {
    game.update(msg.gameState);
    updateTimeLeft();
};

function chatMessage(msg: socketClient.ServerChatMessage) {
    game.update(msg.gameState);
    processMsg(msg, false);

    setCurrentTarget();

    //if we're scrolled to the bottom of messages, stick to the bottom
    let messages = document.getElementById('messages')!;
    // if(messages.scrollTop == (messages.scrollHeight - messages.offsetHeight)){
    messages.scrollTo(0, messages.scrollHeight)
    // }
};

function shuffleTargets() {
    proposedTargetList = shuffle(proposedTargetList);
    refreshProposedTargets(proposedTargetList);
}

function hideSnipedScreen() {
    document.getElementById('main-in-play')!.hidden = false;
    document.getElementById('sniped-screen')!.hidden = true;
}

function showSnipedScreen(msg: string) {
    document.getElementById('main-in-play')!.hidden = true;
    document.getElementById('sniped-screen')!.hidden = false;
    document.getElementById('sniped-alert-text')!.innerText = msg;
    // todo: this broken on firefox mobile
    window.navigator.vibrate([100, 50, 100]);
}

function showGameInfo() {
    let gameInfoDiv = document.getElementById('game-info')!;
    let middle = <HTMLElement>document.getElementsByClassName("middle")[0];
    let sendMessageForm = document.getElementById('send-message-form')!
    if (gameInfoDiv.hidden) {
        gameInfoDiv.hidden = false;
        sendMessageForm.hidden = true;
        middle.hidden = true;
        let playerProgressList = document.getElementById('player-progress')!;
        playerProgressList.innerHTML = '';
        for (let [publicIdString, user] of Object.entries(game.game.userList)) {
            let publicId = parseInt(publicIdString)
            let playerElement = document.createElement('li');
            let [got, remaining] = game.getPlayerProgress(publicId);
            playerElement.innerText = user['username'] + ", current target: " + game.getTarget(publicId, undefined) + ', ' + got + '/' + remaining;
            playerProgressList.appendChild(playerElement);
        }
    } else {
        gameInfoDiv.hidden = true;
        sendMessageForm.hidden = false;
        middle.hidden = false;
    }
}

// gameId needs to be decoded because it contains a '/'
// which gets URI encoded otherwise
const gameId = decodeURIComponent(document.cookie.replace(/(?:(?:^|.*;\s*)gameId\s*\=\s*([^;]*).*$)|^.*$/, "$1"));
console.log(gameId);
const privateId = document.cookie.replace(/(?:(?:^|.*;\s*)privateId\s*\=\s*([^;]*).*$)|^.*$/, "$1");
const publicId = parseInt(document.cookie.replace(/(?:(?:^|.*;\s*)publicId\s*\=\s*([^;]*).*$)|^.*$/, "$1"));

let socket: SocketIOClient.Socket;
let proposedTargetList: number[];

window.onload = function () {

    // do in onload, so that we can't accidentally receive a socket event
    // before dom loaded
    socket = socketClient.setup(
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

    document.getElementById("exit-sniped-screen")!.addEventListener('click', hideSnipedScreen);

    document.getElementById("show-game-info")!.addEventListener('click', showGameInfo);

    document.getElementById("shuffle-targets")!.addEventListener('click', shuffleTargets);

    document.getElementById("mark-snipe")!.addEventListener('click', markSnipe);

    document.getElementById("mark-not-snipe")!.addEventListener('click', markNotSnipe);

    document.getElementById("delete-preview")!.addEventListener('click', deletePreview);

    document.getElementById("camera-button")!.addEventListener('click', cameraButton);

    document.getElementById('photo-input')!.addEventListener('change', photoInput);

    document.getElementById('send-message-form')!.addEventListener('submit', function (ev) {
        ev.preventDefault();
        return false;
    });
    document.getElementById('send-message')!.addEventListener('click', sendTextMessage);
    document.getElementById('send-photo-message')!.addEventListener('click', sendPhotoMessage);

    document.getElementById('make-targets')!.onclick = function (_) {
        console.log(game.game.state)
        if (game.game.state == game.states.TARGETS_MADE) {
            if (confirm('Start the game?')) {
                socketClient.startGame(socket);
            }
        } else {
            var gameLength = Number((<HTMLInputElement>document.getElementById('game-length')).value) * 1000 * 60;
            var countDown = Number((<HTMLInputElement>document.getElementById('count-down')).value) * 1000 * 60;
            socketClient.makeTargets(socket, { gameLength: gameLength, countDown: countDown, proposedTargetList: proposedTargetList });
        }
    }

    document.getElementById('undo-make-targets')!.onclick = function (_) {
        socketClient.undoMakeTargets(socket);
    }

    document.getElementById('stop-game')!.onclick = function (_) {
        if (confirm('Finish the game?')) {
            socketClient.stopGame(socket);
        }
    }
};