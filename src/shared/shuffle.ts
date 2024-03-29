export function shuffle(userList: number[]): number[] {
  // inside-out fisher-yates
  // https://en.wikipedia.org/wiki/Fisher%E2%80%93Yates_shuffle
  // note: wiki says multiplying a float and rounding down can give bias
  const shuffled = []
  for (let boundary = 0; boundary < userList.length; boundary += 1) {
    shuffled.push(userList[boundary])
    const swapPosition = Math.floor(Math.random() * (boundary + 1))
    if (swapPosition != boundary) {
      ;[shuffled[boundary], shuffled[swapPosition]] = [
        shuffled[swapPosition],
        shuffled[boundary],
      ]
    }
  }
  return shuffled
}
