import * as SharedGame from "../shared/game"
import * as api from "../shared/clientApi"
import { MapData } from "./mapAnnotations"
import * as Game from "./game"

import * as Sentry from "@sentry/browser"

Sentry.init({ dsn: process.env.BROWSER_SENTRY })
if (process.env.SENTRY_TESTS == "true") {
  Sentry.captureException(new Error("sentry test archived.html"))
}

function urlGameId(): string {
  return window.location.href.split("/").pop()!
}

function getPublicId(): number | undefined {
  const cookieGameId = decodeURIComponent(
    document.cookie.replace(
      /(?:(?:^|.*;\s*)gameId\s*=\s*([^;]*).*$)|^.*$/,
      "$1"
    )
  )

  if (cookieGameId == urlGameId()) {
    const publicId = parseInt(
      document.cookie.replace(
        /(?:(?:^|.*;\s*)publicId\s*=\s*([^;]*).*$)|^.*$/,
        "$1"
      )
    )
    if (isNaN(publicId)) {
      return undefined
    }
    return publicId
  }
  return undefined
}

function getPlayerColor(playerPublicId: number) {
  //todo: let player choose and store in game
  return playerColours[playerPublicId % playerColours.length]
}

function buildTargetsState(playerPublicId: number) {
  const outerLi = document.createElement("li")
  outerLi.setAttribute("class", "player-area")
  const summaryStats = document.createElement("p")

  const username = Game.getUsername(playerPublicId)
  const [got, remaining] = Game.getPlayerProgress(playerPublicId)
  const total = got + remaining

  summaryStats.innerText = `${username}: ${got}/${total}`

  outerLi.appendChild(summaryStats)
  const ul = document.createElement("ul")
  ul.setAttribute("class", "target-list")
  outerLi.appendChild(ul)
  for (const snipeInfo of Game.getSnipeInfos(playerPublicId)) {
    const innerLi = document.createElement("li")
    const targetButton = document.createElement("button")
    const targetUsername = Game.getUsername(snipeInfo.target)
    const sniperUsername = Game.getUsername(snipeInfo.snipePlayer)
    targetButton.onclick = function () {
      showPhoto(`${sniperUsername} got ${targetUsername}`, snipeInfo.imageId)
    }
    targetButton.innerText = targetUsername
    innerLi.appendChild(targetButton)
    ul.prepend(innerLi)
  }
  return outerLi
}

function buildPlayerTickBox(publicId: number, username: string) {
  const labelItem = document.createElement("li")
  const inputId = `show-player-${username}`
  const label = document.createElement("label")
  label.innerText = username
  label.setAttribute("for", inputId)
  const playerColour = getPlayerColor(publicId)
  label.setAttribute("style", `background-color: ${playerColour}`)
  const input = document.createElement("input")
  input.setAttribute("type", "checkbox")
  input.setAttribute("checked", "true")
  input.addEventListener("change", () => {
    const checkbox = <HTMLInputElement>(
      document.getElementById(`show-player-${username}`)
    )
    if (checkbox.checked) {
      mapData.showPlayer(publicId)
    } else {
      mapData.hidePlayer(publicId)
    }
  })
  input.setAttribute("id", inputId)
  labelItem.appendChild(label)
  labelItem.appendChild(input)
  return labelItem
}

function setUpPage(gameState: SharedGame.ClientGame, publicId?: number) {
  if (publicId != undefined) {
    const username = gameState.userList[publicId].username
    document.getElementById("username")!.innerText = username
  } else {
    document.getElementById("username")!.innerText = "observer"
  }

  let winner
  if (gameState.winner && !isNaN(parseInt(gameState.winner))) {
    winner = gameState.userList[parseInt(gameState.winner!)].username
  } else {
    winner = gameState.winner
  }
  document.getElementById("game-result")!.innerText = `🎉🎉${winner}🎉🎉`

  const targetsState = document.getElementById("targets-state")!
  for (const playerPublicId of Game.getPublicIds(true)) {
    const outerLi = buildTargetsState(playerPublicId)
    targetsState.appendChild(outerLi)
  }

  if (publicId != undefined) {
    const username = Game.getUsername(publicId)
    document
      .getElementById("next-game-link")!
      .setAttribute("href", `/?code=${gameState.nextCode}&username=${username}`)
  } else {
    // todo: also check the game data was live from the API before showing
    document.getElementById("next-game-link")!.hidden = true
  }

  const options = document.getElementById("options")!
  for (const playerPublicId of Game.getPublicIds()) {
    const labelItem = buildPlayerTickBox(
      playerPublicId,
      Game.getUsername(playerPublicId)
    )
    options.appendChild(labelItem)
  }
}

async function getDataFromApi(): Promise<SharedGame.ClientGame> {
  const gameId = urlGameId()
  const gameState = api.gameJson(gameId)
  return gameState
}

let map: google.maps.Map
let gameState: SharedGame.ClientGame
let mapData: MapData

window.onload = function () {
  getDataFromApi().then(
    (lgameState: SharedGame.ClientGame) => {
      gameState = lgameState
      const publicId = getPublicId()

      Game.update(gameState)

      setUpPage(gameState, publicId)
      map = new google.maps.Map(document.getElementById("map")!, {
        zoom: 17,
        mapTypeId: "satellite",
      })
      map.setOptions({
        zoomControl: true,
        gestureHandling: "greedy",
        // changing the option doesn't seem to quite be working
        // disableDefaultUI: false,
      })

      mapData = new MapData(gameState, map, showPhoto, playerColours)
      // observers won't have a public ID
      if (publicId != undefined) {
        mapData.center(publicId)
      } else {
        mapData.center()
      }
    },
    (_) => {
      // this looks terribad - change to a local hide/show thing
      ;(<HTMLDivElement>document.getElementById("error"))!.hidden = false
      ;(<HTMLDivElement>document.getElementById("main"))!.hidden = true
      ;(<HTMLParagraphElement>(
        document.getElementById("error-message")
      )).innerText = "Game does not exist"
    }
  )

  document.getElementById("show-map")!.onclick = function () {
    document.getElementById("info")!.hidden =
      !document.getElementById("info")!.hidden
    document.getElementById("options")!.hidden =
      !document.getElementById("options")!.hidden
  }
  document.getElementById("photo-back")!.onclick = function () {
    document.getElementById("photo-div")!.hidden = true
    document.getElementById("main")!.hidden = false
    ;(<HTMLImageElement>document.getElementById("photo")).src =
      "/static/shitty_loader.jpg"
  }

  document.getElementById("time-lapse")!.oninput = function () {
    const sliderValue = Number.parseInt(
      (<HTMLInputElement>document.getElementById("time-lapse")).value
    )

    const sliderPercent = sliderValue / 1000

    const startTime = Game.startTime()
    const endTime = Game.endTime()

    const scaledMaxTime = startTime + (endTime - startTime) * sliderPercent

    mapData.changeTimeRange(0, scaledMaxTime)
  }
}

// hardcode distinct colours, and reuse if too many players
// todo: find a js library to handle colour generation
const playerColours = [
  "#FFB300", //Vivid Yellow
  "#803E75", //Strong Purple
  "#FF6800", //Vivid Orange
  "#A6BDD7", //Very Light Blue
  "#C10020", //Vivid Red
  "#CEA262", //Grayish Yellow
  "#817066", //Medium Gray

  // The following don't work well for people with defective color vision
  "#007D34", //Vivid Green
  "#F6768E", //Strong Purplish Pink
  "#00538A", //Strong Blue
  "#FF7A5C", //Strong Yellowish Pink
  "#53377A", //Strong Violet
  "#FF8E00", //Vivid Orange Yellow
  "#B32851", //Strong Purplish Red
  "#F4C800", //Vivid Greenish Yellow
  "#7F180D", //Strong Reddish Brown
  "#93AA00", //Vivid Yellowish Green
  "#593315", //Deep Yellowish Brown
  "#F13A13", //Vivid Reddish Orange
  "#232C16", //Dark Olive Green
]

function showPhoto(text: string, imageIndex: number) {
  document.getElementById("photo-div")!.hidden = false
  document.getElementById("main")!.hidden = true
  document.getElementById("photo-text")!.innerText = text
  ;(<HTMLImageElement>document.getElementById("photo")).src = Game.getImageUrl(
    imageIndex,
    false
  )!
}
