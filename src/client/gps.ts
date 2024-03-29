import * as dev from "./dev"
import * as SharedGame from "../shared/game"

import * as geolocate from "mock-geolocation"

if (dev.testMode()) {
  geolocate.use()
}

const position: SharedGame.Position = {
  latitude: null,
  longitude: null,
  accuracy: null,
  heading: null,
  speed: null,
  timestamp: null,
  altitude: null,
  altitudeAccuracy: null,
}

function mockCords() {
  position.latitude! += (Math.random() - 0.5) * 0.0001
  position.longitude! += (Math.random() - 0.5) * 0.0001
  position.timestamp = Date.now()
  position.accuracy = 5
  //todo: mock other stuff
  //todo: save real world results and fill this with them?
}

function setup(callback: (position: SharedGame.Position) => void) {
  if (dev.testMode()) {
    console.log("set fake start pos")
    position.latitude = 51.389
    position.longitude = 0.012
    const fakeUpdate = () => {
      console.log("mock pos update")
      mockCords()
      geolocate.change(position)
      window.setTimeout(fakeUpdate, 1000)
    }
    fakeUpdate()
  }
  // a random stack overflow post suggested that firefox is more accurate
  // with enableHighAccuracy set to false
  // https://stackoverflow.com/questions/60365952/geolocation-api-not-working-in-firefox-mobile#comment106851658_60365952
  const isFirefoxBrowser = navigator.userAgent.includes("Firefox")
  navigator.geolocation.watchPosition(
    (geolocationPosition) => {
      updatePosition(geolocationPosition, callback)
    },
    dontUpdatePosition,
    { enableHighAccuracy: !isFirefoxBrowser }
  )
}

function updatePosition(
  geolocationPosition: GeolocationPosition,
  callback: (position: SharedGame.Position) => void
) {
  position.latitude = geolocationPosition.coords.latitude
  position.longitude = geolocationPosition.coords.longitude
  position.accuracy = geolocationPosition.coords.accuracy
  position.heading = geolocationPosition.coords.heading
  position.speed = geolocationPosition.coords.speed
  position.timestamp = geolocationPosition.timestamp
  position.altitude = geolocationPosition.coords.altitude
  position.altitudeAccuracy = geolocationPosition.coords.altitudeAccuracy
  callback(position)
}

let userNotified = false

function dontUpdatePosition(err: GeolocationPositionError): void {
  if (!userNotified) {
    userNotified = true
    alert("GPS failed, please allow location access")
    console.log("geo loc failed")
    console.log(err)
  }
}

export { setup, position }
