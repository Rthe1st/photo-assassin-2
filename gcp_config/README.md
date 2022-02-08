# GCP Config

We use GCP to store photos.

The client send pictures to our Node server that then uploads them to GCP.
The server then broadcasts the URLs of the stored file to clients in the game.
And they download the image directly from GCP.

Todo: have both uploads and downloads go via cloudflare.
Will require a worker to handle authentication.

## Permissions

Ideally we'd like to limit access to our bucket to be only via only Cloudflare.
To do this we could restrict access to Cloudflare IPs
https://www.cloudflare.com/en-gb/ips/

However, Google Cloud Storage does not allow you to restrict access by IP.
We must be public or restrict to a server account.
https://stackoverflow.com/a/27298841/5832565
https://stackoverflow.com/questions/49127629/google-managed-services-bigquery-cloud-storage-etc-via-a-vpc-vpn

Options:

- Use VPC Service Controls to manage bucket access
  - IP restrictions can be done with that
  - But it requires an Organization, which requires Google Workspace
  - Maybe I should make an Organization for this not using my personal account anyway
  - Possibly could use `Access Context Manager` to set an access level for cloudflare IPs, and then set the access level as an IAM conditions
    - https://cloud.google.com/iam/docs/conditions-resource-attributes
    - https://cloud.google.com/storage/docs/access-control
    - but this still requires an organization
- Restrict access to a service account, and use Cloudflare workers to add auth details to the request
  - Worker fetch to Google Cloud will use cache
  - But worker will be invoked even for requests that would be cached anyway
  - https://community.cloudflare.com/t/can-i-make-a-worker-only-run-if-cloudflare-hasnt-cached-the-page/94565
  - how the worker would authneticate:
  - https://cloud.google.com/storage/docs/authentication#apiauth
- Switch to amazon S3, they support IP access control
  - https://stackoverflow.com/a/11457790/5832565
  - I'd rather not have yet another cloud account to manage

## Cloudflare DNS config

We restrict access to our storage via cloudflare, so clients can't by pass caching and because Google Storage doesn't support SSL without a load balencer.

To do this, we have a cname record like this:

```
NAME                  TYPE     DATA
storage               CNAME    c.storage.googleapis.com.
```

I assume google use the Host header to work out what bucket to go to.

https://cloud.google.com/storage/docs/static-website#examples
https://cloud.google.com/storage/docs/request-endpoints#cname

## On Cloudflare and SSL

We must use buckets that are a single subdomain of prangten.com.
`subdomain.prangten.com`, not `subsubdomain.subdomain.prangten.com`

This is because we use Cloudlflare's Flexable SSL, which gives us a certificate covering _.prangten.com.
Wildcarded certificates like that do not cover _.\*.prangten.com
https://community.cloudflare.com/t/cloudflare-ssl-not-working-on-subdomains/3792/6
https://community.cloudflare.com/t/community-tip-fixing-ssl-error-no-cypher-overlap-in-mozilla/42323

So, to cover that you'd need to:

- pay Cloudflare $10/month to support to get this https://developers.cloudflare.com/ssl/advanced-certificate-manager
- Upgrade to a business account to upload custom certificates (that with make with lets encrypt or similar)

## Setup

Install the [GCP SDK](https://cloud.google.com/sdk/docs/quickstart#deb)
It requires python

Project ID is

```bash
export PROJECT_ID=photo-assassin-270012
```

## Bucket setup

```bash
export BUCKET_NAME="storage-photo-assassin.prangten.com"
# make bucket
gsutil mb -b on -l europe-west2 gs://$BUCKET_NAME
# show buckets
gsutil ls
# Make readable from the internet without auth:
gsutil iam ch allUsers:objectViewer gs://$BUCKET_NAME
# setup CORS so we can fetch JSON (for game data)
gsutil cors set ./gcp_config/cors.json gs://$BUCKET_NAME
```

### Node service account for uploads

How it was setup:

```bash
export STORAGE_UPLOAD_ACCOUNT="storage-upload-account"
# https://cloud.google.com/iam/docs/creating-managing-service-accounts#creating
gcloud iam service-accounts create $STORAGE_UPLOAD_ACCOUNT
# https://cloud.google.com/storage/docs/access-control/using-iam-permissions#bucket-add
# https://cloud.google.com/storage/docs/access-control/iam-roles
gsutil iam ch serviceAccount:$STORAGE_UPLOAD_ACCOUNT@$PROJECT_ID.iam.gserviceaccount.com:roles/storage.objectAdmin gs://$BUCKET_NAME
# see the account you made
gcloud iam service-accounts list
# Create a service account key
gcloud iam service-accounts keys create ./gcp_config/storage-upload-account.json --iam-account=$STORAGE_UPLOAD_ACCOUNT@$PROJECT_ID.iam.gserviceaccount.com
```

We then extract the following keys from the created json file and put them in .env

```
GCP_PRIVATE_KEY_ID
GCP_PRIVATE_KEY
GCP_CLIENT_EMAIL
GCP_CLIENT_ID
```
