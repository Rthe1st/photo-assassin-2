import * as dev from './dev'
import * as SharedGame from '../shared/game'

var position: SharedGame.Position = { latitude: null, longitude: null };

// try https://github.com/2gis/mock-geolocation
//set up timer, change the gps every X secondsa, to trigger the normal gps watcher
function mockCords() {
    position.latitude! += (Math.random() - 0.5) * 0.0001;
    position.longitude! += (Math.random() - 0.5) * 0.0001;
}

function setup(callback: (position: SharedGame.Position) => void) {
    if (dev.testMode()) {
        console.log("set fake start pos");
        position.latitude = 51.389;
        position.longitude = 0.012;
        console.log(position);
    } else {
        console.log("real start pos");
        navigator.geolocation.getCurrentPosition((geolocationPosition) => {
            updatePosition(geolocationPosition, callback);
        });
    }

    navigator.geolocation.watchPosition(
        (geolocationPosition) => updatePosition(geolocationPosition, callback),
        dontUpdatePosition,
        { "enableHighAccuracy": true, "maximumAge": 10000 }
    );
}

function updatePosition(geolocationPosition: Position, callback: (position: SharedGame.Position) => void) {
    if (dev.testMode()) {
        console.log("mock pos update");
        mockCords();
    } else {
        console.log("real pos update");
        position.latitude = geolocationPosition.coords.latitude;
        position.longitude = geolocationPosition.coords.longitude;
    }
    callback(position);
}
function dontUpdatePosition(err: PositionError): void {
    alert("geo faild");
    console.log("geo loc failed");
    console.log(err);
}

export { setup, position }
