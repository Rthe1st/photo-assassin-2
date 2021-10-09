// const kalmanFilter = new GPSKalmanFilter()
// const updatedCoords = []

//  for (let index = 0; index < coords.length; index++) {
//    const { lat, lng, accuracy, timestampInMs } = coords[index]
//    updatedCoords[index] = kalmanFilter.process(lat, lng, accuracy, timestampInMs)
//  }

// https://stackoverflow.com/a/59331539
// todo: we may want to tune this to track the data more closely
// as our positions are relatively time sensitive
// and kalman introduces a kind of time lag in positions
export class GPSKalmanFilter {
  decay: number
  variance: number
  minAccuracy: number
  timestampInMs: number
  lat: number
  lng: number

  constructor(decay = 3) {
    this.decay = decay
    this.variance = -1
    this.minAccuracy = 1
    this.lat = 0
    this.lng = 0
    this.timestampInMs = 0
  }

  process(lat: number, lng: number, accuracy: number, timestampInMs: number) {
    if (accuracy < this.minAccuracy) accuracy = this.minAccuracy

    if (this.variance < 0) {
      this.timestampInMs = timestampInMs
      this.lat = lat
      this.lng = lng
      this.variance = accuracy * accuracy
    } else {
      const timeIncMs = timestampInMs - this.timestampInMs

      if (timeIncMs > 0) {
        this.variance += (timeIncMs * this.decay * this.decay) / 1000
        this.timestampInMs = timestampInMs
      }

      const _k = this.variance / (this.variance + accuracy * accuracy)
      this.lat += _k * (lat - this.lat)
      this.lng += _k * (lng - this.lng)

      this.variance = (1 - _k) * this.variance
    }

    return [this.lng, this.lat]
  }
}
