import * as dev from './dev'

var position = { latitude: null, longitude: null };

// try https://github.com/2gis/mock-geolocation
//set up timer, change the gps every X secondsa, to trigger the normal gps watcher
function mockCords(){
    position.latitude += (Math.random()-0.5)*0.0001;
    position.longitude += (Math.random()-0.5)*0.0001;
}

function setup(callback){
    if (dev.testMode()){
        console.log("set fake start pos");
        position.latitude = 51.402129;
        position.longitude = -0.022835;
        console.log(position);
    }else{
        console.log("real start pos")
        geolocation.getCurrentPosition((geolocationPosition) => {
            updatePosition(geolocationPosition, callback);
        });
    }

    navigator.geolocation.watchPosition(
        (geolocationPosition) => updatePosition(geolocationPosition, callback),
        dontUpdatePosition,
        { "enableHighAccuracy": true, "maximumAge": 10000 }
    );
}

function updatePosition(geolocationPosition, callback) {
    if(dev.testMode()){
        console.log("mock pos update");
        mockCords();
    }else{
        console.log("real pos update");
        position.latitude = geolocationPosition.coords.latitude;
        position.longitude = geolocationPosition.coords.longitude;
    }
    callback(position);
}
function dontUpdatePosition(a) {
    alert("geo faild");
    console.log("geo loc failed");
    console.log(a);
}

export { setup, position }