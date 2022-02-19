import * as SharedGame from "../shared/game"
import * as Game from "./game"
import * as kalman from "./kalman"

import * as dat from "dat.gui"

interface PlayerSnipe {
  marker: google.maps.Marker
  arrow?: google.maps.Polyline
}

export class MapData {
  gameState: SharedGame.ClientGame
  map: google.maps.Map

  minTime: number
  maxTime: number
  playerColours: string[]

  datGui: dat.GUI
  settings: {
    kalman: boolean
    raw: boolean
    gpsPoints: boolean
    targets: boolean
  }

  playerPaths: { [key: number]: google.maps.Polyline }
  rawPlayerPaths: { [key: number]: google.maps.Polyline }
  playerSnipes: { [key: number]: PlayerSnipe[] }
  points: { [key: number]: google.maps.Circle[] }
  snipeClickHandler: (title: string, imageId: number) => void

  constructor(
    gameState: SharedGame.ClientGame,
    map: google.maps.Map,
    snipeClickHandler: (title: string, imageId: number) => void,
    playerColours: string[]
  ) {
    this.settings = {
      kalman: true,
      raw: false,
      gpsPoints: false,
      targets: true,
    }
    this.datGui = new dat.GUI()
    this.datGui.hide()
    this.datGui.add(this.settings, "kalman")
    this.datGui.add(this.settings, "raw")
    this.datGui.add(this.settings, "gpsPoints")
    this.datGui.add(this.settings, "targets")
    this.gameState = gameState
    this.map = map

    this.playerPaths = []
    this.rawPlayerPaths = []
    this.playerSnipes = []
    this.points = []
    this.snipeClickHandler = snipeClickHandler
    this.playerColours = playerColours

    this.minTime = 0
    this.maxTime = Number.POSITIVE_INFINITY

    for (const playerPublicId of Game.getPublicIds()) {
      // I think most of these functions could do with being their own classes
      this.drawPath(playerPublicId, this.minTime, this.maxTime)
      this.drawPlayerGpsPoints(playerPublicId, this.minTime, this.maxTime)
      this.drawKalmanPath(playerPublicId, this.minTime, this.maxTime)
      this.drawSnipes(playerPublicId, this.snipeClickHandler)
    }
  }

  getPlayerColor(playerPublicId: number): string {
    //todo: let player choose and store in game
    return this.playerColours[playerPublicId % this.playerColours.length]
  }

  center(playerPublicId?: number) {
    if (playerPublicId) {
      this.map.setCenter(this.playerPaths[playerPublicId].getPath().getAt(0))
    } else {
      this.map.setCenter(this.playerPaths[0].getPath().getAt(0))
    }
  }

  changeTimeRange(minTime: number, maxTime: number) {
    this.minTime = minTime
    this.maxTime = maxTime
    for (const playerPublicId of Game.getPublicIds()) {
      this.drawPath(playerPublicId, this.minTime, this.maxTime)
      this.drawPlayerGpsPoints(playerPublicId, this.minTime, this.maxTime)
      this.drawKalmanPath(playerPublicId, this.minTime, this.maxTime)
    }
  }

  hidePlayer(playerPublicId: number) {
    this.playerPaths[playerPublicId].setMap(null)
    this.rawPlayerPaths[playerPublicId].setMap(null)
    for (const snipe of this.playerSnipes[playerPublicId]) {
      snipe.marker.setMap(null)
      if (snipe.arrow) {
        snipe.arrow.setMap(null)
      }
    }
    for (const point of this.points[playerPublicId]) {
      point.setMap(null)
    }
  }

  showPlayer(playerPublicId: number) {
    this.drawPath(playerPublicId, this.minTime, this.maxTime)
    this.drawPlayerGpsPoints(playerPublicId, this.minTime, this.maxTime)
    this.drawKalmanPath(playerPublicId, this.minTime, this.maxTime)
    this.drawSnipes(playerPublicId, this.snipeClickHandler)
  }

  drawPath(playerPublicId: number, minTime: number, maxTime: number) {
    if (!this.settings.raw) {
      return
    }
    if (!(playerPublicId in this.rawPlayerPaths)) {
      this.rawPlayerPaths[playerPublicId] = new google.maps.Polyline({
        path: [],
        geodesic: true,
        strokeColor: this.getPlayerColor(playerPublicId),
        strokeOpacity: 1.0,
        strokeWeight: 2,
      })
    }

    const positions = this.gameState.positions![playerPublicId]
    const path = []
    for (const position of positions) {
      if (position.timestamp! < minTime) {
        continue
      }
      const rawLatlng: google.maps.LatLngLiteral = {
        lat: position.latitude!,
        lng: position.longitude!,
      }
      path.push(rawLatlng)
      if (position.timestamp! > maxTime) {
        break
      }
    }

    this.rawPlayerPaths[playerPublicId].setPath(path)
    this.rawPlayerPaths[playerPublicId].setMap(this.map)
  }

  drawKalmanPath(playerPublicId: number, minTime: number, maxTime: number) {
    if (!this.settings.kalman) {
      return
    }
    if (!(playerPublicId in this.playerPaths)) {
      const lineSymbol = {
        path: "M 0,-1 0,1",
        strokeOpacity: 1,
        scale: 4,
      }
      this.playerPaths[playerPublicId] = new google.maps.Polyline({
        path: [],
        geodesic: true,
        strokeColor: this.getPlayerColor(playerPublicId),
        strokeOpacity: 0,
        icons: [
          {
            icon: lineSymbol,
            offset: "0",
            repeat: "20px",
          },
        ],
        strokeWeight: 2,
      })
    }

    const positions = this.gameState.positions![playerPublicId]
    const path = []
    const kalmanFilter = new kalman.GPSKalmanFilter()
    for (const position of positions) {
      if (position.timestamp! < minTime) {
        continue
      }
      const updatedCoord = kalmanFilter.process(
        position.latitude!,
        position.longitude!,
        position.accuracy!,
        position.timestamp!
      )
      const estLongitude = updatedCoord[0]
      const estLatitude = updatedCoord[1]
      const latlng: google.maps.LatLngLiteral = {
        lat: estLatitude,
        lng: estLongitude,
      }

      if (position.timestamp! > maxTime) {
        break
      }
      const previous = path[path.length - 1]
      if (previous !== undefined) {
        // require geometry lib to be loaded
        // https://stackoverflow.com/a/15226237
        const dist = google.maps.geometry.spherical.computeDistanceBetween(
          new google.maps.LatLng(estLatitude, estLongitude),
          new google.maps.LatLng(previous.lat, previous.lng)
        )
        if (dist < 5) {
          continue
        }
      }
      path.push(latlng)
    }

    this.playerPaths[playerPublicId].setPath(path)
    this.playerPaths[playerPublicId].setMap(this.map)
  }

  // this is mostly for debug
  // players should just be looking at the paths we draw
  drawPlayerGpsPoints(
    playerPublicId: number,
    minTime: number,
    maxTime: number
  ) {
    if (!this.settings.gpsPoints) {
      return
    }
    const positions = this.gameState.positions![playerPublicId]

    if (!(playerPublicId in this.points)) {
      this.points[playerPublicId] = []
      for (const position of positions) {
        const rawLatlng: google.maps.LatLngLiteral = {
          lat: position.latitude!,
          lng: position.longitude!,
        }

        this.points[playerPublicId].push(
          new google.maps.Circle({
            strokeColor: "#00FF00",
            strokeOpacity: 0.8,
            strokeWeight: 2,
            fillColor: "#00FF00",
            fillOpacity: 0.35,
            center: rawLatlng,
            radius: 0.1,
          })
        )
      }
    }

    for (let index = 0; index < positions.length; index += 1) {
      const position = positions[index]
      if (position.timestamp! < minTime) {
        this.points[playerPublicId][index].setMap(null)
      } else if (position.timestamp! > maxTime) {
        this.points[playerPublicId][index].setMap(null)
      } else {
        this.points[playerPublicId][index].setMap(this.map)
      }
    }
  }

  drawSnipes(
    playerPublicId: number,
    clickHandler: (title: string, imageId: number) => void
  ) {
    if (!this.settings.targets) {
      return
    }
    const snipes = Game.getSnipeInfos(playerPublicId)
    //todo: plot non-snipe images as well
    if (!(playerPublicId in this.playerSnipes)) {
      this.playerSnipes[playerPublicId] = []
      for (const snipeInfo of snipes) {
        if (snipeInfo.undone) {
          //todo: show them but greyed out or w/e
          continue
        }
        let latlng: google.maps.LatLngLiteral
        if (snipeInfo.position != undefined) {
          latlng = {
            lat: snipeInfo.position.latitude!,
            lng: snipeInfo.position.longitude!,
          }
        } else {
          // todo: choose a default point
          // middle of the map? interpolation between known positions?
          latlng = { lat: 0, lng: 0 }
        }

        const sniperName = Game.getUsername(playerPublicId)

        const target = Game.getUsername(snipeInfo.target)
        const title = `${sniperName} got ${target}`
        const marker = new google.maps.Marker({
          position: latlng,
          title: title,
        })
        //this needs to be passed in
        marker.addListener("click", function () {
          clickHandler(title, snipeInfo.imageId)
        })

        const obj: PlayerSnipe = { marker: marker, arrow: undefined }

        if (snipeInfo.targetPosition != undefined) {
          const lineSymbol = {
            path: google.maps.SymbolPath.FORWARD_CLOSED_ARROW,
          }
          const targetLatLng: google.maps.LatLngLiteral = {
            lat: snipeInfo.targetPosition.latitude!,
            lng: snipeInfo.targetPosition.longitude!,
          }
          const arrow = new google.maps.Polyline({
            path: [latlng, targetLatLng],
            icons: [
              {
                icon: lineSymbol,
                offset: "100%",
              },
            ],
          })
          obj.arrow = arrow
        }
        this.playerSnipes[playerPublicId].push(obj)
      }
    }

    const snipeObjs = this.playerSnipes[playerPublicId]

    for (let index = 0; index < snipes.length; index += 1) {
      // todo: timestamp support
      // let snipe = snipes[index];
      // if (snipe.timestamp! < minTime) {
      //     snipeObjs[index].setMap(null);
      // }else if (snipe.timestamp! < minTime) {
      //     snipeObjs[index].setMap(null);
      // }else {
      //     snipeObjs[index].setMap(this.map);
      // }
      const snipeObj = snipeObjs[index]
      snipeObj["marker"].setMap(this.map)
      if (snipeObj["arrow"]) {
        snipeObj["arrow"].setMap(this.map)
      }
    }
  }
}
