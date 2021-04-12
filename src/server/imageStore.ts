// responsible for storing and fetching
// images with a 3rd party provider (google cloud at the moment)

import * as stream from 'stream'

import * as gcStorage from '@google-cloud/storage';
import {ClientGame} from '../shared/game'
import * as api from '../shared/clientApi';

export class ImageStore{

    bucket: gcStorage.Bucket;

    constructor(){
        const storage = new gcStorage.Storage({keyFilename: 'gcp_config/storage-upload-account.json'});

        const bucketName = 'storage-photo-assassin.prangten.com';

        this.bucket = storage.bucket(bucketName);
    }

    getUploadImageUrl(gameCode: string, id: number): string{
        return `${gameCode}/image/${id}.webp`
    }

    async uploadImage(image: Buffer, gameCode: string, id: number): Promise<string>{
        return this.upload(image, this.getUploadImageUrl(gameCode, id))
    }

    getUploadImageLowResUrl(gameCode: string, id: number): string{
        return `${gameCode}/low-res/${id}.webp`
    }

    async uploadLowResImage(image: Buffer, gameCode: string, id: number): Promise<string>{
        return this.upload(image, this.getUploadImageLowResUrl(gameCode, id))
    }

    // todo: verify the image type being uploaded
    // and the size
    async upload(image: Buffer, path: string): Promise<string>{
        // cloud storage doesn't actually have a concept of folders
        // but gsutil fakes it when a path contains forward slashes
        // https://cloud.google.com/storage/docs/gsutil/addlhelp/HowSubdirectoriesWork
    
        // todo: we should set the content type as well
        // https://stackoverflow.com/a/38789848/5832565
        const file = this.bucket.file(path);
    
        var bufferStream = new stream.PassThrough();
        
        bufferStream.end(Buffer.from(image));
    
        return new Promise((resolve, reject)=>{
            bufferStream
            .pipe(file.createWriteStream({contentType: "image/webp"}))
            .on('error', function(err) {
                reject(err);
            })
            .on('finish', function() {
                resolve(`https://storage-photo-assassin.prangten.com/${path}`);
            });
        });
    }

    // we only need to upload the client game
    // as we only upload once the game is finished
    // todo: if we would like to back up long running games
    // we will have to separately upload the Server Game state
    // to a non-public bucket
    // but this would only be for the use case where a server crashes
    // and needs to resume games
    async uploadGameState(gameState: ClientGame, code: string): Promise<string>{
        let asJson = JSON.stringify(gameState);
        let path = api.gameStatePath(code);
        const file = this.bucket.file(path);
    
        const readable = stream.Readable.from([asJson])

        return new Promise((resolve, reject)=>{
            readable.pipe(file.createWriteStream({contentType: "application/json"}))
            .on('error', function(err) {
                reject(err);
            })
            .on('finish', function() {
                resolve(api.gameStateUrl(code));
            });
        });

    }
}
