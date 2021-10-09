import * as gps from "./gps"
import * as game from "./game"
import * as SharedGame from "../shared/game"
import * as socketClient from "../shared/socketClient"
import * as imageManipulation from "./imageManipulation"
import * as gmap from "./gmap"

import * as notifications from "./notifications"

import * as Sentry from "@sentry/browser"
import { shuffle } from "../shared/shuffle"

Sentry.init({ dsn: process.env.BROWSER_SENTRY })
if (process.env.SENTRY_TESTS == "true") {
  Sentry.captureException(new Error("sentry test in index.js"))
}

//todo: deduplicate this code from createChatElement
function updatePlaceholderChatElement(
  li: HTMLElement,
  sender: string,
  message: string,
  imageId?: number,
  snipeInfo?: SharedGame.SnipeInfo,
  lowResUrl?: string | undefined
) {
  const messages = document.getElementById("messages")!
  messages.removeChild(li)
  messages.appendChild(li)
  li.setAttribute("class", "own-message")
  if (imageId != undefined) {
    const img = new Image()
    img.classList.add("message-image")
    img.setAttribute("id", `image-${imageId}`)
    if (lowResUrl != undefined) {
      img.src = lowResUrl
    } else {
      img.src = "/static/shitty_loader_preview.jpg"
    }
    let snipeScreenText = `From: ${sender}`
    if (snipeInfo != undefined) {
      snipeScreenText += `target: ${game.getUsername(snipeInfo.target)}`
    }
    if (message != "") {
      snipeScreenText += `, '${message}'`
    }
    //todo: should we only add this once image is availble?
    // maybe no, because we should just show the low res image when clicked
    // if the full one isn't ready
    img.onclick = () => showSnipedScreen(snipeScreenText, imageId)
    const placeHolderImg = <HTMLImageElement>(
      document.getElementById(`image--1`)!
    )
    placeHolderImg.replaceWith(img)
    if (snipeInfo != undefined) {
      // img.setAttribute('id', `snipe-${snipeInfo.index}`)
      const voteButton = document.createElement("button")
      voteButton.setAttribute("class", "vote-button")
      const targetUser = game.getUsername(snipeInfo.target)
      voteButton.innerText = `${targetUser} not in the picture?`
      voteButton.onclick = function () {
        if (confirm(`Was ${targetUser} not in the picture?`)) {
          const msg: socketClient.ClientBadSnipe = {
            snipeInfosIndex: snipeInfo.index,
          }
          socketClient.badSnipe(socket, msg)
          voteButton.onclick = null
          voteButton.disabled = true
        }
      }
      li.appendChild(voteButton)
      if (snipeInfo.undone) {
        markSnipeAsBad(snipeInfo.index)
      }
    }
  }
  return li
}

function createChatElement(
  sender: string,
  message: string,
  imageId?: number,
  snipeInfo?: SharedGame.SnipeInfo,
  lowResUrl?: string | undefined
) {
  const li = document.createElement("li")
  const previousMessage = game.getLastMessage()
  let previousSender
  if (previousMessage) {
    previousSender = game.getUsername(previousMessage.publicId)
  }
  if (game.getUsername(publicId) == sender) {
    li.setAttribute("class", "own-message")
  } else {
    li.setAttribute("class", "message-li")
    if (previousSender !== sender) {
      const span = document.createElement("span")
      span.innerText = sender
      span.classList.add("username")
      li.appendChild(span)
    }
  }
  if (imageId != undefined) {
    const img = new Image()
    img.classList.add("message-image")
    img.setAttribute("id", `image-${imageId}`)
    if (lowResUrl != undefined) {
      img.src = lowResUrl
    } else {
      img.src = "/static/shitty_loader_preview.jpg"
    }
    let snipeScreenText = `From: ${sender}`
    if (snipeInfo != undefined) {
      snipeScreenText += `target: ${game.getUsername(snipeInfo.target)}`
    }
    if (message != "") {
      snipeScreenText += `, '${message}'`
    }
    //todo: should we only add this once image is availble?
    // maybe no, because we should just show the low res image when clicked
    // if the full one isn't ready
    img.onclick = () => showSnipedScreen(snipeScreenText, imageId)
    li.appendChild(img)
    if (snipeInfo != undefined) {
      // img.setAttribute('id', `snipe-${snipeInfo.index}`)
      const voteButton = document.createElement("button")
      voteButton.setAttribute("class", "vote-button")
      const targetUser = game.getUsername(snipeInfo.target)
      voteButton.innerText = `Was ${targetUser} not in the picture?`
      voteButton.onclick = function () {
        if (confirm(`Was ${targetUser} not in the picture?`)) {
          const msg: socketClient.ClientBadSnipe = {
            snipeInfosIndex: snipeInfo.index,
          }
          socketClient.badSnipe(socket, msg)
          voteButton.onclick = null
          voteButton.disabled = true
        }
      }
      li.appendChild(voteButton)
    }
  }
  if (message != "") {
    const paragraph = document.createElement("p")
    paragraph.innerText = message
    li.appendChild(paragraph)
  }
  const messages = document.getElementById("messages")!
  messages.appendChild(li)
  if (snipeInfo != undefined && snipeInfo.undone) {
    markSnipeAsBad(snipeInfo.index)
  }
  return li
}

function processMsg(
  msg: socketClient.ServerChatMessage,
  isReplay: boolean,
  lowResUrl?: string
) {
  if (msg.botMessage) {
    createChatElement("Gamebot3000", msg.botMessage)
  }

  if (
    msg.publicId == publicId &&
    game.clientOnly.unconfirmedMessages[msg.nonce]
  ) {
    const li = game.clientOnly.unconfirmedMessages[msg.nonce].placeHolderMessage
    updatePlaceholderChatElement(
      li,
      game.getUsername(msg.publicId),
      msg.text,
      msg.imageId,
      msg.snipeInfo,
      lowResUrl
    )
  } else {
    createChatElement(
      game.getUsername(msg.publicId),
      msg.text,
      msg.imageId,
      msg.snipeInfo,
      lowResUrl
    )
    if (isReplay) {
      return
    }
    if (
      publicId == game.getLastSnipedPlayerId(msg.publicId) &&
      msg.imageId != undefined
    ) {
      showSnipedScreen(
        game.getUsername(msg.publicId) + " sniped you!",
        msg.imageId,
        true
      )
    }
  }
  game.addChatMessage(msg)
}

function deletePreview(triggeredByBackButton = false) {
  if (!confirm("Delete this photo?")) {
    return
  }

  if (!triggeredByBackButton) {
    history.back()
  }

  document.getElementById("photo-preview")!.hidden = true
  document.getElementById("main-in-play")!.hidden = false
  ;(<HTMLInputElement>document.getElementById("photo-input")).value = ""
  ;(<HTMLInputElement>document.getElementById("is-snipe")).checked = false
  document.getElementById("mark-snipe-question")!.innerText =
    "Is your target in the picture?"
  document.getElementById("mark-snipe")!.innerText = "Yes"
  document.getElementById("mark-not-snipe")!.innerText = "No ✓"
  ;(<HTMLImageElement>document.getElementById("preview")).src =
    "/static/shitty_loader.jpg"
}

// called without an event when trigger by a 'page forward'
function cameraButton(event?: MouseEvent) {
  document.getElementById("photo-input")!.click()
  if (event) {
    event.preventDefault()
  }
}

function photoInput(event: Event) {
  // if we've been triggered by a 'page forward' button
  // then we don't want to add yet another state
  if (history.state == null || history.state["type"] == "photo-preview") {
    // history for back button
    const message = (<HTMLInputElement>document.getElementById("message")).value
    history.pushState(
      { type: "photo-preview", msg: message, imageId: "" },
      "",
      window.location.pathname
    )
  }
  // hiding/showing the preview screen here, instead of before calling this function
  // means the user will see the main menu flash up before the preview page is loaded - when returning from the photo app
  // the way around this is to do the showing/hiding prior to calling this / the camera app
  // however, we can't do that because the user might press 'back' in th mobile app
  // if they do that, then we have no way to detect it and the screen ends up in a broken state
  // fix: change to using the media streaming api
  // so we can capture images without a native app
  document.getElementById("photo-preview")!.hidden = false
  document.getElementById("main-in-play")!.hidden = true
  ;(<HTMLInputElement>document.getElementById("photo-message")).value = (<
    HTMLInputElement
  >document.getElementById("message")).value
  const img = <HTMLImageElement>document.getElementById("preview")

  //todo: can a change event leave files undefined?
  img.src = URL.createObjectURL((<HTMLInputElement>event.target).files![0])
  const target = game.getTarget(publicId)
  document.getElementById(
    "mark-snipe-question"
  )!.innerText = `Is ${target} in the picture?`
}

function messagePlaceholder(text: string, has_photo = false) {
  // before sending a message to the server, call this
  // which will create a placeholder chat element
  // for the message and which will be deleted when server broadcasts the message (confirming it recieved it)
  // todo: fix left over placeholder messages if connection dies before confirmation
  // could do that by just reloading message history from server whenever connection dies
  // use -1 as image id because image IDs start from 0
  let element
  if (has_photo) {
    element = createChatElement(game.getUsername(publicId), text, -1)
  } else {
    element = createChatElement(game.getUsername(publicId), text)
  }

  const array = new Uint32Array(1)
  window.crypto.getRandomValues(array)
  const nonce = array[0]
  game.clientOnly.unconfirmedMessages[nonce] = {
    placeHolderMessage: element,
  }
  return nonce
}

function sendTextMessage(ev: MouseEvent) {
  const messageElement = <HTMLInputElement>document.getElementById("message")
  if (messageElement.value == "") {
    return
  }
  const nonce = messagePlaceholder(messageElement.value)
  const message: socketClient.ClientChatMessage = {
    text: messageElement.value,
    position: gps.position,
    image: undefined,
    isSnipe: undefined,
    nonce: nonce,
  }

  socketClient.chatMessage(socket, message)
  messageElement.value = ""
  ev.preventDefault()
  // keep the keyboard open, incase user wants to send another message
  document.getElementById("message")!.focus()
  return false
}

function sendPhotoMessage(ev: MouseEvent) {
  const text = (<HTMLInputElement>document.getElementById("photo-message"))
    .value

  const nonce = messagePlaceholder(text, true)

  const file: File = (<HTMLInputElement>document.getElementById("photo-input"))
    .files![0]

  const isSnipe = (<HTMLInputElement>document.getElementById("is-snipe"))
    .checked
  file
    .arrayBuffer()
    .then(imageManipulation.process)
    .then((reducedArraryBuffer) => {
      const message = {
        text: text,
        image: reducedArraryBuffer,
        position: gps.position,
        isSnipe: isSnipe,
        nonce: nonce,
      }
      socketClient.chatMessage(socket, message)
    })
    .catch((e) => {
      console.log("error trying to send picture message")
      console.log(e)
    })
  ;(<HTMLInputElement>document.getElementById("message")).value = ""
  ;(<HTMLInputElement>document.getElementById("photo-message")).value = ""
  ;(<HTMLInputElement>document.getElementById("photo-input")).value = ""
  ;(<HTMLInputElement>document.getElementById("is-snipe")).checked = false
  document.getElementById("mark-snipe")!.innerText = "Yes"
  document.getElementById("mark-not-snipe")!.innerText = "No ✓"
  history.back()
  document.getElementById("photo-preview")!.hidden = true
  document.getElementById("main-in-play")!.hidden = false
  ev.preventDefault()
  return false
}

function setCurrentTarget() {
  const targetElement = document.getElementById("target")!
  targetElement.innerText = game.getTarget(publicId, undefined)
}

function updateTimeLeft(sync = true) {
  const timeLeftElement = <HTMLParagraphElement>(
    document.getElementById("time-left")!
  )
  let timeLeft = undefined
  const previousUpdateTime = whenTimeWasLastUpdated
  whenTimeWasLastUpdated = Date.now()
  if (sync) {
    const formatedSubState =
      game.game.subState![0].toUpperCase() +
      game.game.subState!.substr(1).toLowerCase()
    ;(<HTMLParagraphElement>document.getElementById("sub-state")!).innerText =
      formatedSubState
    if (game.game.subState == "COUNTDOWN") {
      timeLeft = game.game.timeLeft! - game.game.chosenSettings.gameLength
    } else {
      timeLeft = game.game.timeLeft
    }

    localTimeLeft = timeLeft!
  } else {
    // todo: we should probably update it on the local gamestate
    // elapsed time is in ms
    const elapsedTime = whenTimeWasLastUpdated - previousUpdateTime
    localTimeLeft -= elapsedTime
    if (localTimeLeft < 0) {
      localTimeLeft = 0
    }
    timeLeft = localTimeLeft
  }
  const timeInSeconds = timeLeft! / 1000
  const timeMinutes = Math.floor(timeInSeconds / 60)
  const timeSeconds = Math.floor(timeInSeconds % 60)
  timeLeftElement.innerText = `${timeMinutes}m${timeSeconds}s`
}

function setSnipe(value: boolean) {
  // ui is a bit confusing, make clearer
  const isSnipe = <HTMLInputElement>document.getElementById("is-snipe")
  if (value) {
    isSnipe.checked = true
    document.getElementById("mark-snipe")!.innerText = "Yes ✓"
    document.getElementById("mark-not-snipe")!.innerText = "No"
  } else {
    isSnipe.checked = false
    document.getElementById("mark-snipe")!.innerText = "Yes"
    document.getElementById("mark-not-snipe")!.innerText = "No ✓"
  }
}

function markNotSnipe(_: MouseEvent) {
  setSnipe(false)
}

function markSnipe(_: MouseEvent) {
  if (game.game.subState == game.inPlaySubStates.COUNTDOWN) {
    alert("Can't snipe yet - wait to countdown is over")
    return
  }
  setSnipe(true)
}

function inPlayView() {
  document
    .getElementById("main-in-play")
    ?.insertBefore(
      <Node>document.getElementById("map"),
      document.getElementById("game-info")
    )
  if (publicId != 0) {
    ;(<HTMLButtonElement>document.getElementById("stop-game")).hidden = true
  }
  updateTimeLeft()
  if (updateTimeInterval == undefined) {
    updateTimeInterval = setInterval(() => updateTimeLeft(false), 1000)
  }
  setCurrentTarget()
  document.getElementById("not-started")!.hidden = true
  document.getElementById("in-play")!.hidden = false
  document.getElementById("sub-state")!.innerText = game.game.subState!
}

function readOnlyView() {
  const settings = game.getSettings()
  refreshProposedTargets(settings.proposedTargetList)
  ;(<HTMLInputElement>document.getElementById("game-length")).value = String(
    settings.gameLength / 1000 / 60
  )
  document.getElementById("game-length")!.setAttribute("readonly", "")
  document.getElementById("game-length")!.setAttribute("class", "look-disabled")
  ;(<HTMLInputElement>document.getElementById("count-down")).value = String(
    settings.countDown / 1000 / 60
  )
  document.getElementById("count-down")!.setAttribute("readonly", "")
  document.getElementById("count-down")!.setAttribute("class", "look-disabled")
  ;(<HTMLButtonElement>document.getElementById("shuffle-targets")).disabled =
    true
  resetUserList(game.game.userList)
  const deleteButtons = document.getElementsByClassName("delete-user-button")
  for (let i = 0; i < deleteButtons.length; i++) {
    ;(<HTMLButtonElement>deleteButtons[i]).hidden = true
  }
}

function markSnipeAsBad(snipeInfosIndex: number) {
  const imageId = game.getSnipeImageId(snipeInfosIndex)
  const snipeImage = document.getElementById(`image-${imageId}`)!
  if (!document.getElementById(`snipe-text-${snipeInfosIndex}`)) {
    const undotext = document.createElement("p")
    undotext.innerText = "BAD SNIPE"
    undotext.setAttribute("class", "undotext")
    undotext.setAttribute("id", `snipe-text-${snipeInfosIndex}`)
    snipeImage.parentNode!.appendChild(undotext)
    ;(<HTMLButtonElement>(
      (<Element>snipeImage.parentNode).getElementsByTagName("button")[0]
    )).hidden = true
  }
}

function refreshProposedTargets(proposedTargetList: number[]) {
  const targetList = document.getElementById("proposed-target-list")!
  targetList.innerHTML = ""
  for (const [sniper, target] of game.getProposedTargetPairs(
    proposedTargetList
  )) {
    const element = document.createElement("li")
    const text = `${sniper}: ${target}`
    element.innerText = text
    targetList.appendChild(element)
  }
}

function initialization(msg: socketClient.ServerInitializationMsg) {
  console.log("initialized")
  game.update(msg.gameState)
  for (const message of msg.chatHistory) {
    if (message.imageId != undefined) {
      const lowResUrl = game.getImageUrl(message.imageId, true)
      // lowResUrl could still come back undefined
      // if the image has been processed by the server
      // but the call to upload it to gcloud hasn't finished yet
      processMsg(message, true, lowResUrl)
    } else {
      processMsg(message, true)
    }
  }
  const userNameElements = document.getElementsByClassName("current-username")
  for (let index = 0; index < userNameElements.length; index++) {
    ;(<HTMLElement>userNameElements[index]).innerText =
      game.getUsername(publicId)
  }
  //the first time, before they move
  gps.setup((position) => {
    socketClient.positionUpdate(socket, position)
    const googlePosition = { lat: position.latitude!, lng: position.longitude! }
    gameMap.drawPlayer(googlePosition)
    gameMap.center(googlePosition)
  })
  if (game.game.state == game.states.IN_PLAY) {
    inPlayView()
  } else if (game.game.state == game.states.NOT_STARTED) {
    document.getElementById("not-started")!.hidden = false
    if (publicId != 0) {
      readOnlyView()
    } else {
      proposedTargetList = game.getSettings().proposedTargetList
      document.getElementById("not-started")!.hidden = false
      refreshProposedTargets(proposedTargetList)
      // todo: move into game as isGameReady()
      if (Object.entries(game.game.userList).length > 1) {
        document.getElementById("start")!.removeAttribute("disabled")
      }
      resetUserList(game.game.userList)
      const deleteButtons =
        document.getElementsByClassName("delete-user-button")
      for (let i = 0; i < deleteButtons.length; i++) {
        ;(<HTMLButtonElement>deleteButtons[i]).hidden = false
      }
    }
  }
}

function badSnipe(msg: socketClient.ServerBadSnipeMsg) {
  game.update(msg.gameState)
  setCurrentTarget()
  for (const snipeInfoIndex of msg.undoneSnipeIndexes) {
    markSnipeAsBad(snipeInfoIndex)
  }
}

function resetUserList(userList: SharedGame.UserList) {
  const userListElement = document.getElementById("user-list")!
  userListElement.innerHTML = ""
  for (const [publicId, user] of Object.entries(userList)) {
    userListElement.append(
      createUserElement(user["username"], parseInt(publicId))
    )
  }
}

function createUserElement(username: string, publicId: number) {
  const li = document.createElement("li")
  li.setAttribute("class", "user-info-area")
  const text = document.createElement("p")
  text.setAttribute("class", "user-joined-text")
  text.innerText = username
  li.appendChild(text)
  let remove: HTMLButtonElement
  if (publicId == 0) {
    remove = document.createElement("button")
    remove.setAttribute("class", "delete-user-button")
    remove.disabled = true
    remove.innerText = "Admin"
    li.appendChild(remove)
  } else {
    remove = document.createElement("button")
    remove.setAttribute("id", `delete-user-${publicId}`)
    remove.setAttribute("class", "delete-user-button")
    remove.innerText = "Remove"
    remove.onclick = function () {
      if (confirm(`Remove ${username} from the game?`)) {
        socketClient.removeUser(socket, publicId)
      }
    }
    li.appendChild(remove)
  }
  return li
}

function newUser(msg: socketClient.NewUserMsg) {
  game.update(msg.gameState)
  proposedTargetList = game.getSettings().proposedTargetList
  refreshProposedTargets(proposedTargetList)
  if (publicId == 0 && Object.entries(game.game.userList).length > 1) {
    document.getElementById("start")!.removeAttribute("disabled")
  }
  const newUser = game.getUsername(msg.publicId)
  const userList = document.getElementById("user-list")!
  userList.append(createUserElement(newUser, msg.publicId))
}

function removeUser(msg: socketClient.RemoveUserMsg) {
  game.update(msg.gameState)
  proposedTargetList = game.getSettings().proposedTargetList
  refreshProposedTargets(proposedTargetList)
  resetUserList(game.game.userList)
}

function refreshSettings(msg: socketClient.ServerUpdateSettingsMsg) {
  game.update(msg.gameState)
  if (publicId != 0) {
    readOnlyView()
  }
}

let updateTimeInterval: NodeJS.Timeout | undefined = undefined
let localTimeLeft = 0
let whenTimeWasLastUpdated = Date.now()

function start(msg: socketClient.ServerStartMsg) {
  game.update(msg.gameState)
  inPlayView()
}

function finished() {
  location.reload()
}

function timeLeft(msg: socketClient.ServerTimeLeftMsg) {
  game.update(msg.gameState)
  updateTimeLeft()
}

function resizeDone(msg: socketClient.ServerResizeDone) {
  game.game.lowResUploadsDone[msg.imageId] = msg.url
  const placeHolderImage = <HTMLImageElement>(
    document.getElementById(`image-${msg.imageId}`)
  )
  if (placeHolderImage != null) {
    const img = new Image()
    img.classList.add("message-image")
    img.setAttribute("id", `image-${msg.imageId}`)
    img.src = msg.url
    img.onclick = placeHolderImage.onclick
    placeHolderImage.replaceWith(img)
  }
}

function imageUploadDone(msg: socketClient.ServerImageUploadDone) {
  game.game.imageUploadsDone[msg.imageId] = msg.url
  if (document.getElementById("sniped-screen")!.hidden == false) {
    const previousSnipedScreen = document.getElementById("snipe-image")!
    const img = new Image()
    img.setAttribute("id", "snipe-image")
    img.src = msg.url
    previousSnipedScreen.replaceWith(img)
    // (<HTMLImageElement>document.getElementById('snipe-image')).src = msg.url;
  }
}

function chatMessage(msg: socketClient.ServerChatMessage) {
  game.update(msg.gameState)
  // because this is a fresh message
  // we know that the lowResUrl will not be available for the image yet
  // and we expect to receive it in a follow up event
  processMsg(msg, false)

  setCurrentTarget()

  //if we're scrolled to the bottom of messages, stick to the bottom
  const messages = document.getElementById("messages-container")!
  // if(messages.scrollTop == (messages.scrollHeight - messages.offsetHeight)){
  messages.scrollTo(0, messages.scrollHeight)
  // }
}

function shuffleTargets() {
  proposedTargetList = shuffle(proposedTargetList)
  refreshProposedTargets(proposedTargetList)
  updateSettings()
}

window.onpopstate = function () {
  // handle forward buttons
  if (history.state !== null && history.state["type"] == "photo") {
    showSnipedScreen(
      history.state["msg"],
      history.state["imageId"],
      false,
      false
    )
  } else if (
    history.state !== null &&
    history.state["type"] == "photo-preview"
  ) {
    cameraButton()
    // handle back buttons
  } else if (!document.getElementById("sniped-screen")!.hidden) {
    hideSnipedScreen(true)
  } else if (!document.getElementById("photo-preview")!.hidden) {
    deletePreview(true)
  }
}

function hideSnipedScreen(triggeredByBackButton = false) {
  if (!triggeredByBackButton) {
    history.back()
  }
  document.getElementById("main-in-play")!.hidden = false
  document.getElementById("sniped-screen")!.hidden = true
}

function showSnipedScreen(
  msg: string,
  imageId: number,
  shouldVibrate = false,
  newHistory = true
) {
  if (newHistory) {
    history.pushState(
      { type: "photo", msg: msg, imageId: imageId },
      "",
      window.location.pathname
    )
  }
  document.getElementById("sniped-alert-text")!.innerText = msg
  const imageUrl = game.getImageUrl(imageId, false)

  // we always set the image to the loading image first
  // because if the real image is not in the browser cache it takes time to load
  // and during the time whatever image was previously on the snipe page will still show
  // because we show the loading image before every snipe page
  // it's already going to be in the browser cache
  // when viewing the snipe screen for a 2nd time
  ;(<HTMLImageElement>document.getElementById("snipe-image")).src =
    "/static/shitty_loader.jpg"
  if (imageUrl) {
    ;(<HTMLImageElement>document.getElementById("snipe-image")).src = imageUrl
  }
  // do this after updating the image
  // so the user doesn't see the previous snipe screen
  // while we setup the new one
  document.getElementById("main-in-play")!.hidden = true
  document.getElementById("sniped-screen")!.hidden = false

  // todo: this broken on firefox mobile
  if (shouldVibrate) {
    window.navigator.vibrate([100, 50, 100])
  }
}

function showGameInfo() {
  const gameInfoDiv = document.getElementById("game-info")!
  const middle = <HTMLElement>document.getElementsByClassName("middle")[0]
  const sendMessageForm = document.getElementById("send-message-form")!
  if (gameInfoDiv.hidden) {
    gameInfoDiv.hidden = false
    sendMessageForm.hidden = true
    middle.hidden = true
    const playerProgressList = document.getElementById("player-progress")!
    playerProgressList.innerHTML = ""
    for (const [publicIdString, user] of Object.entries(game.game.userList)) {
      const publicId = parseInt(publicIdString)
      const playerElement = document.createElement("li")
      const [got, remaining] = game.getPlayerProgress(publicId)
      playerElement.innerText =
        user["username"] +
        ", current target: " +
        game.getTarget(publicId, undefined) +
        ", " +
        got +
        "/" +
        remaining
      playerProgressList.appendChild(playerElement)
    }
  } else {
    gameInfoDiv.hidden = true
    sendMessageForm.hidden = false
    middle.hidden = false
  }
}

function updateSettings() {
  const gameLength =
    Number((<HTMLInputElement>document.getElementById("game-length")).value) *
    1000 *
    60
  const countDown =
    Number((<HTMLInputElement>document.getElementById("count-down")).value) *
    1000 *
    60
  socketClient.updateSettings(socket, {
    gameLength: gameLength,
    countDown: countDown,
    proposedTargetList: proposedTargetList,
  })
}

// gameId needs to be decoded because it contains a '/'
// which gets URI encoded otherwise
const gameId = decodeURIComponent(
  document.cookie.replace(/(?:(?:^|.*;\s*)gameId\s*=\s*([^;]*).*$)|^.*$/, "$1")
)
const privateId = document.cookie.replace(
  /(?:(?:^|.*;\s*)privateId\s*=\s*([^;]*).*$)|^.*$/,
  "$1"
)
const publicId = parseInt(
  document.cookie.replace(
    /(?:(?:^|.*;\s*)publicId\s*=\s*([^;]*).*$)|^.*$/,
    "$1"
  )
)

let socket: SocketIOClient.Socket
let proposedTargetList: number[]
let gameMap: gmap.Gmap

window.onload = function () {
  const notification = new notifications.GameNotification("notification")

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
    "",
    (reason: any) => {
      notification.notify("disconnected")
      console.log(reason)
    },
    (reason: any) => {
      notification.notify("error")
      console.log(reason)
    },
    (reason: any) => {
      notification.notify("disconnecting")
      console.log(reason)
    },
    (reason: any) => {
      notification.notify("connect error")
      console.log(reason)
    }
  )

  gameMap = new gmap.Gmap(<HTMLDivElement>document.getElementById("map"))

  document
    .getElementById("exit-sniped-screen")!
    .addEventListener("click", () => hideSnipedScreen())

  document
    .getElementById("show-game-info")!
    .addEventListener("click", showGameInfo)

  document
    .getElementById("shuffle-targets")!
    .addEventListener("click", shuffleTargets)

  document.getElementById("mark-snipe")!.addEventListener("click", markSnipe)

  document
    .getElementById("mark-not-snipe")!
    .addEventListener("click", markNotSnipe)

  document
    .getElementById("delete-preview")!
    .addEventListener("click", () => deletePreview())

  document
    .getElementById("camera-button")!
    .addEventListener("click", cameraButton)

  document.getElementById("photo-input")!.addEventListener("change", photoInput)

  document
    .getElementById("send-message-form")!
    .addEventListener("submit", function (ev) {
      ev.preventDefault()
      return false
    })
  document
    .getElementById("send-message")!
    .addEventListener("click", sendTextMessage)
  document
    .getElementById("send-photo-message")!
    .addEventListener("click", sendPhotoMessage)
  ;(<HTMLInputElement>document.getElementById("count-down")).onchange =
    updateSettings
  ;(<HTMLInputElement>document.getElementById("game-length")).onchange =
    updateSettings

  document.getElementById("start")!.onclick = function (_) {
    if (confirm("Start the game?")) {
      const gameLength =
        Number(
          (<HTMLInputElement>document.getElementById("game-length")).value
        ) *
        1000 *
        60
      const countDown =
        Number(
          (<HTMLInputElement>document.getElementById("count-down")).value
        ) *
        1000 *
        60
      socketClient.startGame(socket, {
        gameLength: gameLength,
        countDown: countDown,
        proposedTargetList: proposedTargetList,
      })
    }
  }

  document.getElementById("stop-game")!.onclick = function (_) {
    if (confirm("Finish the game?")) {
      socketClient.stopGame(socket)
    }
  }

  const gameLink = document.getElementById("game-link")!
  gameLink.innerText = `Game: ${gameId}\n(Click to share)`

  gameLink.onclick = function () {
    navigator.clipboard.writeText(window.location.href).then(() => {
      notification.notify("Link copied")
    })
  }

  for (const element of document.getElementsByClassName("toggle-map")) {
    ;(<HTMLElement>element).onclick = function (_) {
      const mapElement = document.getElementById("map")!
      const middle = document.getElementById("not-started-settings")!
      const middleInPlay = document.getElementById("messages-container")!
      const sendMsg = document.getElementById("send-message-form")!
      if (mapElement.hidden) {
        mapElement.hidden = false
        middle.hidden = true
        middleInPlay.hidden = true
        sendMsg.hidden = true
      } else {
        mapElement.hidden = true
        middle.hidden = false
        middleInPlay.hidden = false
        sendMsg.hidden = false
      }
    }
  }
}
