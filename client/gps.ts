import * as dev from './dev'
import * as SharedGame from '../shared/game'

var position: SharedGame.Position = {
    latitude: null,
    longitude: null,
    accuracy: null,
    heading: null,
    speed: null,
    timestamp: null,
    altitude: null,
    altitudeAccuracy: null,
};

// try https://github.com/2gis/mock-geolocation
//set up timer, change the gps every X seconds, to trigger the normal gps watcher
function mockCords() {
    position.latitude! += (Math.random() - 0.5) * 0.0001;
    position.longitude! += (Math.random() - 0.5) * 0.0001;
    //todo: mock other stuff
    //todo: save real world results and fill this with them?
}

function setup(callback: (position: SharedGame.Position) => void) {
    if (dev.testMode()) {
        console.log("set fake start pos");
        position.latitude = 51.389;
        position.longitude = 0.012;
        console.log(position);
    }
    setInterval(()=>{
        // do all the nest callbacks here mean
        // that positions could be added out of order?
        navigator.geolocation.getCurrentPosition(
            (geolocationPosition) => {
                updatePosition(geolocationPosition, callback);
            },
            dontUpdatePosition,
            { enableHighAccuracy: true}
        ),
        1000
    })
}

function updatePosition(geolocationPosition: Position, callback: (position: SharedGame.Position) => void) {
    if (dev.testMode()) {
        console.log("mock pos update");
        mockCords();
    } else {
        console.log("real pos update");
        position.latitude = geolocationPosition.coords.latitude;
        position.longitude = geolocationPosition.coords.longitude;
        position.accuracy = geolocationPosition.coords.accuracy;
        position.heading = geolocationPosition.coords.heading;
        position.speed = geolocationPosition.coords.speed;
        position.timestamp = geolocationPosition.timestamp;
        position.altitude = geolocationPosition.coords.altitude;
        position.altitudeAccuracy = geolocationPosition.coords.altitudeAccuracy;
    }
    callback(position);
}

let userNotified = false;

function dontUpdatePosition(err: PositionError): void {
    if(!userNotified){
        userNotified = true;
        alert("geo faild");
        console.log("geo loc failed");
        console.log(err);
    }
}

export { setup, position }
