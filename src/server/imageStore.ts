// responsible for storing and fetching
// images with a 3rd party provider (google cloud at the moment)

import * as stream from 'stream'

import * as gcStorage from '@google-cloud/storage';

export class ImageStore{

    bucket: gcStorage.Bucket;

    constructor(){
        const storage = new gcStorage.Storage({keyFilename: 'gcp_config/storage-upload-account.json'});

        const bucketName = 'storage-photo-assassin.prangten.com';

        this.bucket = storage.bucket(bucketName);
    }

    async uploadImage(image: Buffer, gameCode: string, id: number): Promise<string>{
        return this.upload(image, `${gameCode}/image/${id}`)
    }

    async uploadLowResImage(image: Buffer, gameCode: string, id: number): Promise<string>{
        return this.upload(image, `${gameCode}/low-res/image/${id}`)
    }

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
            .pipe(file.createWriteStream())
            .on('error', function(err) {
                reject(err);
            })
            .on('finish', function() {
                resolve(`https://storage-photo-assassin.prangten.com/${path}`);
            });
        });
    }
}
