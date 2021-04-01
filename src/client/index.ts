import * as gps from './gps'
import * as game from './game'
import * as SharedGame from '../shared/game'
import * as socketClient from '../shared/socketClient'

import * as notifications from './notifications';

import * as Sentry from '@sentry/browser';
import { shuffle } from '../shared/shuffle';

Sentry.init({ dsn: process.env.BROWSER_SENTRY });
if (process.env.SENTRY_TESTS == "true") {
    Sentry.captureException(new Error("sentry test in index.js"));
}

function createChatElement(sender: string, message: string, imageId?: number, snipeInfo?: SharedGame.SnipeInfo, lowResUrl?: string|undefined) {
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
        console.log('chat message, image id ' + imageId)
        var img = new Image;
        img.classList.add('message-image');
        img.setAttribute('id', `image-${imageId}`)
        if(lowResUrl != undefined){
            img.src = lowResUrl;
        }else{
            img.src = '/static/shitty_loader.jpg';
        }
        let snipeScreenText = `From: ${sender}`
        if(snipeInfo != undefined){
            snipeScreenText += `target: ${game.getUsername(snipeInfo.target)}`
        }
        if(message != ""){
            snipeScreenText += `, '${message}'`
        }
        //todo: should we only add this once image is availble?
        // maybe no, because we should just show the low res image when clicked
        // if the full one isn't ready
        img.onclick = () => showSnipedScreen(snipeScreenText, imageId);
        li.appendChild(img);
        if (snipeInfo != undefined) {
            // img.setAttribute('id', `snipe-${snipeInfo.index}`)
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
    return li
}

function processMsg(msg: socketClient.ServerChatMessage, isReplay: boolean, lowResUrl?: string) {
    if (msg.botMessage) {
        createChatElement('Gamebot3000', msg.botMessage);
    }

    if(msg.publicId == publicId){
        if(game.clientOnly.unconfirmedMessages[msg.nonce]){
            game.clientOnly.unconfirmedMessages[msg.nonce].placeHolderMessage.remove()
        }
    }

    createChatElement(game.getUsername(msg.publicId), msg.text, msg.imageId, msg.snipeInfo, lowResUrl);
    
    if (isReplay) {
        return;
    }
    if (publicId == game.getLastSnipedPlayerId(msg.publicId) && msg.imageId != undefined) {
        showSnipedScreen(game.getUsername(msg.publicId) + " sniped you!", msg.imageId, true);
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

function messagePlaceholder(text:string){
    // before sending a message to the server, call this
    // which will create a placeholder chat element
    // for the message and which will be deleted when server broadcasts the message (confirming it recieved it)
    // todo: fix left over placeholder messages if connection dies before confirmation
    // could do that by just reloading message history from server whenever connection dies
    let element = createChatElement(game.getUsername(publicId), text)
    var array = new Uint32Array(1);
    window.crypto.getRandomValues(array);
    let nonce = array[0]
    game.clientOnly.unconfirmedMessages[nonce] = {
        placeHolderMessage: element
    }
    return nonce
}

function sendTextMessage(ev: MouseEvent) {
    let messageElement = <HTMLInputElement>document.getElementById('message');
    if (messageElement.value == '') {
        return;
    }
    let nonce = messagePlaceholder(messageElement.value)
    let message: socketClient.ClientChatMessage = {
        text: messageElement.value,
        position: gps.position,
        image: undefined,
        isSnipe: undefined,
        nonce: nonce
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

    let text = (<HTMLInputElement>document.getElementById('photo-message')).value

    let nonce = messagePlaceholder(text)

    let message = {
        "text": text,
        "image": file,
        "position": gps.position,
        "isSnipe": (<HTMLInputElement>document.getElementById('is-snipe')).checked,
        nonce: nonce
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

function updateTimeLeft(sync: boolean = true) {
    let timeLeftElement = (<HTMLParagraphElement>document.getElementById('time-left')!)
    let timeLeft = undefined
    if(sync){
        (<HTMLParagraphElement>document.getElementById('sub-state')!).innerText = game.game.subState!;
        timeLeft = game.game.timeLeft;
        localTimeLeft = timeLeft!
    }else{
        // todo: we should probably update it on the local gamestate
        // -1000 because localTimeLeft is in ms
        // and we're called (at most) once per second
        localTimeLeft -= 1000;
        if(localTimeLeft < 0){
            localTimeLeft = 0;
        }
        timeLeft = localTimeLeft
    }
    let timeInSeconds = timeLeft! / 1000;
    let timeMinutes = Math.floor(timeInSeconds / 60);
    let timeSeconds = Math.floor(timeInSeconds % 60);
    timeLeftElement.innerText = `${timeMinutes}m${timeSeconds}s`
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
    // don't think this needs to check game state
    // because if theres not game state the button will be hidden
    if (game.game.subState == game.inPlaySubStates.COUNTDOWN) {
        alert("Can't snipe yet - wait to countdown is over");
        return;
    }
    setSnipe(true);
}

function markSnipe(_: MouseEvent) {
    // don't think this needs to check game state
    // because if theres not game state the button will be hidden
    if (game.game.subState == game.inPlaySubStates.COUNTDOWN) {
        alert("Can't snipe yet - wait to countdown is over");
        return;
    }
    setSnipe(false);
}

function inPlayView() {
    if(publicId != 0){
        (<HTMLButtonElement>document.getElementById('stop-game')).hidden = true;
    }
    updateTimeLeft();
    if(updateTimeInterval == undefined){
        updateTimeInterval = setInterval(() => updateTimeLeft(false), 1000)
    }
    setCurrentTarget();
    document.getElementById('not-started')!.hidden = true;
    document.getElementById('in-play')!.hidden = false;
    document.getElementById('sub-state')!.innerText = game.game.subState!;

    //the first time, before they move
    gps.setup((position) => socketClient.positionUpdate(socket, position));
}

function readOnlyView() {
    let settings = game.getSettings();
    refreshProposedTargets(settings.proposedTargetList);
    (<HTMLInputElement>document.getElementById('game-length')).value = String(settings.gameLength / 1000 / 60);
    document.getElementById('game-length')!.setAttribute('readonly', '');
    document.getElementById('game-length')!.setAttribute('class', 'look-disabled');
    (<HTMLInputElement>document.getElementById('count-down')).value = String(settings.countDown / 1000 / 60);
    document.getElementById('count-down')!.setAttribute('readonly', '');
    document.getElementById('count-down')!.setAttribute('class', 'look-disabled');
    (<HTMLButtonElement>document.getElementById('shuffle-targets')).disabled = true;
    resetUserList(game.game.userList);
    let deleteButtons = document.getElementsByClassName('delete-user-button');
    for (let i = 0; i < deleteButtons.length; i++) {
        (<HTMLButtonElement>deleteButtons[i]).hidden = true;
    }
}

function markSnipeAsBad(snipeInfosIndex: number) {
    let imageId = game.getSnipeImageId(snipeInfosIndex)
    let snipeImage = document.getElementById(`image-${imageId}`)!;
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
        var text = `${sniper}: ${target}`;
        element.innerText = text;
        targetList.appendChild(element);
    }
}

function initialization(msg: socketClient.ServerInitializationMsg) {
    console.log('initialized');
    game.update(msg.gameState);
    for (let message of msg.chatHistory) {
        if(message.imageId != undefined){
            let lowResUrl = game.getImageUrl(message.imageId, true);
            // lowResUrl could still come back undefined
            // if the image has been processed by the server
            // but the call to upload it to gcloud hasn't finished yet
            processMsg(message, true, lowResUrl);
        }else{
            processMsg(message, true);
        }
    }
    let userNameElements = document.getElementsByClassName('current-username');
    for (let index = 0; index < userNameElements.length; index++) {
        (<HTMLElement>userNameElements[index]).innerText = game.getUsername(publicId);
    }
    if (game.game.state == game.states.IN_PLAY) {
        inPlayView();
    } else if (game.game.state == game.states.NOT_STARTED) {
        document.getElementById('not-started')!.hidden = false;
        if(publicId != 0){
            readOnlyView();
        }else{
            proposedTargetList = game.getSettings().proposedTargetList;
            document.getElementById('not-started')!.hidden = false;
            refreshProposedTargets(proposedTargetList);
            // todo: move into game as isGameReady()
            if (Object.entries(game.game.userList).length > 1) {
                document.getElementById('start')!.removeAttribute('disabled');
            }
            resetUserList(game.game.userList);
            let deleteButtons = document.getElementsByClassName('delete-user-button');
            for (let i = 0; i < deleteButtons.length; i++) {
                (<HTMLButtonElement>deleteButtons[i]).hidden = false;
            }
        }
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
    if(publicId == 0){
        var remove = document.createElement('button');
        remove.setAttribute('class', 'delete-user-button')
        remove.disabled = true;
        remove.innerText = 'Creator';
        li.appendChild(remove);
    }else{
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
    }
    return li;
}

function newUser(msg: socketClient.NewUserMsg) {
    game.update(msg.gameState);
    proposedTargetList = game.getSettings().proposedTargetList;
    refreshProposedTargets(proposedTargetList);
    if (publicId == 0 && Object.entries(game.game.userList).length > 1) {
        document.getElementById('start')!.removeAttribute('disabled');
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
};

function refreshSettings(msg: socketClient.ServerUpdateSettingsMsg) {
    game.update(msg.gameState);
    if(publicId != 0){
        readOnlyView();
    }
};

let updateTimeInterval: NodeJS.Timeout | undefined = undefined
let localTimeLeft = 0

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

function resizeDone(msg: socketClient.ServerResizeDone){
    game.game.lowResUploadsDone[msg.imageId] = msg.url;
    let placeHolderImage = (<HTMLImageElement>document.getElementById(`image-${msg.imageId}`))
    if(placeHolderImage != null){
        var img = new Image;
        img.classList.add('message-image');
        img.setAttribute('id', `image-${msg.imageId}`)
        img.src = msg.url;
        img.onclick = placeHolderImage.onclick
        placeHolderImage.replaceWith(img)
    }
}

function imageUploadDone(msg: socketClient.ServerImageUploadDone){
    game.game.imageUploadsDone[msg.imageId] = msg.url;
    if(document.getElementById('sniped-screen')!.hidden == false){
        let previousSnipedScreen = document.getElementById('snipe-image')!;
        var img = new Image;
        img.setAttribute('id', 'snipe-image')
        img.src = msg.url;
        previousSnipedScreen.replaceWith(img)
        // (<HTMLImageElement>document.getElementById('snipe-image')).src = msg.url;
    }
}

function chatMessage(msg: socketClient.ServerChatMessage) {
    game.update(msg.gameState);
    // because this is a fresh message
    // we know that the lowResUrl will not be available for the image yet
    // and we expect to receive it in a follow up event
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
    updateSettings();
}

function hideSnipedScreen() {
    document.getElementById('main-in-play')!.hidden = false;
    document.getElementById('sniped-screen')!.hidden = true;
}

function showSnipedScreen(msg: string, imageId: number, shouldVibrate = false) {
    document.getElementById('main-in-play')!.hidden = true;
    document.getElementById('sniped-screen')!.hidden = false;
    document.getElementById('sniped-alert-text')!.innerText = msg;
    let imageUrl = game.getImageUrl(imageId, false);

    if(imageUrl){
        (<HTMLImageElement>document.getElementById('snipe-image')).src = imageUrl;
    }else{
        (<HTMLImageElement>document.getElementById('snipe-image')).src = '/static/shitty_loader.jpg';
    }

    // todo: this broken on firefox mobile
    if(shouldVibrate){
        window.navigator.vibrate([100, 50, 100]);
    }
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

function updateSettings(){
    var gameLength = Number((<HTMLInputElement>document.getElementById('game-length')).value) * 1000 * 60;
    var countDown = Number((<HTMLInputElement>document.getElementById('count-down')).value) * 1000 * 60;
    socketClient.updateSettings(socket, { gameLength: gameLength, countDown: countDown, proposedTargetList: proposedTargetList });
}

// gameId needs to be decoded because it contains a '/'
// which gets URI encoded otherwise
const gameId = decodeURIComponent(document.cookie.replace(/(?:(?:^|.*;\s*)gameId\s*\=\s*([^;]*).*$)|^.*$/, "$1"));
const privateId = document.cookie.replace(/(?:(?:^|.*;\s*)privateId\s*\=\s*([^;]*).*$)|^.*$/, "$1");
const publicId = parseInt(document.cookie.replace(/(?:(?:^|.*;\s*)publicId\s*\=\s*([^;]*).*$)|^.*$/, "$1"));

let socket: SocketIOClient.Socket;
let proposedTargetList: number[];

window.onload = function () {

    let notification = new notifications.GameNotification("notification");

    // do in onload, so that we can't accidentally receive a socket event
    // before dom loaded
    socket = socketClient.setup(
        gameId,
        privateId,
        initialization,
        badSnipe,
        newUser,
        removeUser,
        refreshSettings,
        start,
        finished,
        timeLeft,
        chatMessage,
        resizeDone,
        imageUploadDone,
        '',
        (reason: any) => {notification.notify("disconnected");console.log(reason)},
        (reason: any) => {notification.notify("error");console.log(reason)},
        (reason: any) => {notification.notify("disconnecting");console.log(reason)},
        (reason: any) => {notification.notify("connect error");console.log(reason)},
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

    (<HTMLInputElement>document.getElementById('count-down')).onchange = updateSettings;

    (<HTMLInputElement>document.getElementById('game-length')).onchange = updateSettings;

    document.getElementById('start')!.onclick = function (_) {
        if (confirm('Start the game?')) {
            var gameLength = Number((<HTMLInputElement>document.getElementById('game-length')).value) * 1000 * 60;
            var countDown = Number((<HTMLInputElement>document.getElementById('count-down')).value) * 1000 * 60;
            socketClient.startGame(socket, { gameLength: gameLength, countDown: countDown, proposedTargetList: proposedTargetList });
        }
    }

    document.getElementById('stop-game')!.onclick = function (_) {
        if (confirm('Finish the game?')) {
            socketClient.stopGame(socket);
        }
    }

    const gameLink = document.getElementById("game-link")!;
    gameLink.innerText = `Game: ${gameId}\n(Click to share)`

    gameLink.onclick = function() {
        navigator.clipboard.writeText(window.location.href)
        .then(()=>{
            notification.notify("Link copied");
        });
    }
};