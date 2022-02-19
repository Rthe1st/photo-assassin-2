export class Gmap {
  map: google.maps.Map
  playerPosition: google.maps.Circle | undefined = undefined

  playerPath: google.maps.Polyline | undefined = undefined
  path: google.maps.LatLng[] = []

  constructor(element: HTMLDivElement) {
    this.map = new google.maps.Map(element, {
      zoom: 17,
      mapTypeId: "satellite",
    })
    this.map.setOptions({
      zoomControl: true,
      gestureHandling: "greedy",
      // changing the option doesn't seem to quite be working
      // disableDefaultUI: false,
    })
  }

  center(rawLatlng: google.maps.LatLng) {
    this.map.setCenter(rawLatlng)
  }

  drawPlayer(rawLatlng: google.maps.LatLng) {
    if (this.path.length > 20) {
      this.path.shift()
    }
    this.path.push(rawLatlng)

    if (this.playerPosition != undefined) {
      this.playerPosition!.setCenter(rawLatlng)
      this.playerPath?.setPath(this.path)
    } else {
      this.playerPosition = new google.maps.Circle({
        strokeColor: "#00FF00",
        strokeOpacity: 1,
        strokeWeight: 2,
        fillColor: "#00FFFF",
        fillOpacity: 0.4,
        center: rawLatlng,
        radius: 10,
      })
      this.playerPosition.setMap(this.map)
      this.playerPath = new google.maps.Polyline({
        path: [],
        geodesic: true,
        strokeColor: "#00FF00",
        strokeOpacity: 1.0,
        strokeWeight: 2,
      })
      this.playerPath.setMap(this.map)
    }
  }
}
