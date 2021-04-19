// alternative libs
// http://www.marvinj.org/en/download.html
// https://github.com/nodeca/pica (used my image-blob-reduce under the hood)
// DIY: https://codesalad.dev/blog/how-to-resize-an-image-in-10-lines-of-javascript-29
// import imageBlobReduce from 'image-blob-reduce'

import { Image } from 'image-js';

// can't write jest tests for this as it needs canvas access
export async function process(imageBlob: ArrayBuffer): Promise<ArrayBuffer> {

    // execute().catch(console.error);
    // this borke
    // async function execute() {
    console.log(imageBlob);
    return Image.load(imageBlob)
    .then(i => {
        console.log(i);
        // todo: should actualy be set max width/height to 1000
        // but preserve ratio
        return i.resize({ width: 1000 })
        .toBuffer();
    });

    // return execute();

    // // this seems to be really slow
    // // skip it if image if it's already small enough
    // if(imageBlob.size < 10000000){
    //     return imageBlob;
    // }
    // let b:any = imageBlobReduce;
    // let a = b();
    // // max size of 1000 was chosen arbitrarily
    // // limits size to 10mb (1000*1000*9)
    // // at a max our 9 bytes per pixel (excluding metadata)
    // // Limit server to 10mb to be on the safe side
    // // https://stackoverflow.com/questions/9806091/maximum-file-size-of-jpeg-image-with-known-dimensions
    // return a.toBlob(imageBlob, { max: 1000 }, 0.8)
}
