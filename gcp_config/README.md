# GCP Config

We use GCP to store photos.

The client send pictures to our Node server that then uploads them to GCP.
The server then broadcasts the URLs of the stored file to clients in the game.
And they download the image directly from GCP.

Todo: have both uploads and downloads go via cloudflare.
Will require a worker to handle authentication.

## Setup

Install the [GCP SDK](https://cloud.google.com/sdk/docs/quickstart#deb)
It requires python

Project ID is
```
export PROJECT_ID=photo-assassin-270012
```

## config

Make the bucket:

```bash
export BUCKET_NAME="images.photo-assassin.prangten.com"
gsutil mb -b on -l europe-west2 gs://$BUCKET_NAME
```

```bash
mehow@mehow-ThinkPad-T440: $ gsutil ls
gs://images.prangten.com/

```

Make readable from the internet without auth:

```bash
gsutil iam ch allUsers:objectViewer gs://$BUCKET_NAME
```

### Node service account for uploads

How it was setup:

```bash
export IMAGE_UPLOAD_ACCOUNT="image-upload-account"
# https://cloud.google.com/iam/docs/creating-managing-service-accounts#creating
gcloud iam service-accounts create $IMAGE_UPLOAD_ACCOUNT
# https://cloud.google.com/storage/docs/access-control/using-iam-permissions#bucket-add
# https://cloud.google.com/storage/docs/access-control/iam-roles
gsutil iam ch serviceAccount:image-upload-account@photo-assassin-270012.iam.gserviceaccount.com:roles/storage.objectAdmin gs://$BUCKET_NAME
```

You can see it with:

```bash
gcloud iam service-accounts list
```

### Create a service account key

```bash
gcloud iam service-accounts keys create ./gcp_config/image-upload-account.json     --iam-account=image-upload-account@photo-assassin-270012.iam.gserviceaccount.com
```
