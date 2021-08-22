export class Gmap{

    map: google.maps.Map
    playerPosition: google.maps.Circle | undefined = undefined

    constructor(element: HTMLDivElement){
        this.map = new google.maps.Map(element, {
            zoom: 17,
            mapTypeId: 'satellite',
        });
        this.map.setOptions({
            zoomControl: true,
            gestureHandling: 'greedy',
            // changing the option doesn't seem to quite be working
            // disableDefaultUI: false,
        });
    }

    center(rawLatlng: google.maps.ReadonlyLatLngLiteral){
        this.map.setCenter(rawLatlng)
    }

    drawPlayer(rawLatlng: google.maps.ReadonlyLatLngLiteral){
        if(this.playerPosition != undefined){
            this.playerPosition!.setCenter(rawLatlng);
        }else{
            this.playerPosition = new google.maps.Circle({
                strokeColor: "#00FF00",
                strokeOpacity: 0.8,
                strokeWeight: 2,
                fillColor: "#00FF00",
                fillOpacity: 0.35,
                center: rawLatlng,
                radius: 0.1
            })
        }
    }
}
