import {ImageStore} from './imageStore';
import * as fs from 'fs'
import fetch from 'node-fetch';

// todo: create a test service account
// we don't consider mocking gcp as imageStore shouldn't have much logic
// to test, independent of the GCP connection
test('upload file and access it', async () => {
    let file = fs.readFileSync('./src/server/sample_snipe_image.jpeg');
    let imageStore = new ImageStore();
    let fileUrl = await imageStore.upload(file, 'test/file/path');
    expect(fileUrl).toBe("https://storage-photo-assassin.prangten.com/test/file/path");

    let fileFromCloud = await fetch(fileUrl)
        .then((response)=>{return response.blob()})
        .then((blob)=>{
            // casting because fetch seems to have its own blob type
            // more reason to move to axios?
            return (blob as Blob).arrayBuffer()
        })
        .then((arrayBuffer: ArrayBuffer)=>{
            return Buffer.from(arrayBuffer)
        });

    expect(fileFromCloud).toStrictEqual(file);
    // todo: delete the file from googe cloud
    // so the next run doesn't accidently pass
});
