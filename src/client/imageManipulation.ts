// alternative libs
// http://www.marvinj.org/en/download.html
// https://github.com/nodeca/pica (used my image-blob-reduce under the hood)
// DIY: https://codesalad.dev/blog/how-to-resize-an-image-in-10-lines-of-javascript-29
// import imageBlobReduce from 'image-blob-reduce'

import { Image } from "image-js"

export async function process(imageBlob: ArrayBuffer): Promise<ArrayBuffer> {
  return Image.load(imageBlob).then((i) => {
    let resizeOptions
    if (i.width > i.height) {
      resizeOptions = { width: 1000 }
    } else {
      resizeOptions = { height: 1000 }
    }
    return i
      .resize(resizeOptions)
      .toBuffer({ format: "jpeg", encoder: { quality: 50 } }).buffer
  })
}
