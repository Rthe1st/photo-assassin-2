# Photo Assassin 2

This project is an app to make playing [Photo Assassin](https://github.com/Rthe1st/photo_assassin) more fun.

## Deployment

The server is deployed to an OVH VPS instance using `./scripts/deploy.sh`

Initial server configurations:

- `sudo apt install docker`
- [Install docker-compose 1.29](https://docs.docker.com/compose/install/)
  - It must be at least version 1.29 to [parse env files as expected](https://github.com/docker/compose/issues/8388)
- Set ssh key access
  - `ssh-copy-id -i ~/.ssh/photo-assassin.pub debian@51.38.70.123`
  - In `/etc/ssh/sshd_config`:
    ```
    # PasswordAuthentication yes
    AuthenticationMethods publickey
    ```
  - sudo service sshd restart
  - Setup TLS certs with [certbot](https://certbot.eff.org/instructions?ws=other&os=debianbuster)
    - chown the certs to `debian`
    - ```
      # uses a bind-mount to access the certs
      # but because the app runs as a non-root user in the container
      # the bind-mount folder needs to have the same uid as the user in the container
      # this is more complicated if:
      # 1) you're not running linux
      # 2) Your host user does not have a user ID of 1000 (which is what user node has in the container)
      # https://stackoverflow.com/a/29251160
      sudo chown debian /etc/letsencrypt/live/photo-assassin.prangten.com/cert.pem
      sudo chown debian /etc/letsencrypt/live/photo-assassin.prangten.com/privkey.pem
      sudo chown debian /etc/letsencrypt/live/photo-assassin.prangten.com/chain.pem
      ```
  - Create a games dir and have it owned by debian (or same user as cert files above)
    - `chown debian /home/debian/games`

## Testing the docker image locally

```bash
npm test
# first run this to get changes to server code
# the compose file uses volumes so the image doesn't need to be rebuilt
npm run-script build
# you have to make sure ./.env exists, even though it's not used
# once the files are merged
sudo docker-compose -f ./docker-compose.yml -f ./docker-compose.dev.yml up
# these need the docker container to be running
npm run-script integration-test
```

### NVM

use [nvm](https://github.com/nvm-sh/nvm) to ensure your node and npm versions match the version used by the docker container.
`nvm use` will tell `nvm` to use the version in our`.nvmrc` file

## Build process

We build for 3 situations, starting from typescript source code and es6 module syntax preferred over commonjs.

1. code to be run with node

   - compile typescript files into Javascript
     - build with `tsc`
   - support use of import.metadata.url by running as es6 modules
     - set `"type": "module"` in package.json
     - https://nodejs.org/api/esm.html#esm_enabling
   - Node requires explicit .js extensions on esm module imports
     - https://nodejs.org/api/esm.html
     - use `--experimental-specifier-resolution=node` when running node to fix this
   - Output the compiled JS to a new directory so it's harder for any tooling to accidentally start resolving to js version of a file instead of the ts version

2. code to be run in a browser
   - bundle JS dependencies / build static assets from templates
   - use webpack
   - compile typescript files into Javascript
     - use ts-loader webpack plugin
     - as noted above, webpack + ts-loader means we can't use explicit .js extensions in imports
3. code to be run in Jest tests
   - compile typescript files into Javascript
     - ts-jest jest transform
     - as noted above, jest + ts-jest means we can't use explicit .js extensions in imports
   - use es6 module syntax like import.metadata.url
     - config forces jest/ts-jest into es6 module mode
       - https://jestjs.io/docs/en/ecmascript-modules
       - https://kulshekhar.github.io/ts-jest/docs/next/guides/esm-support
     - I couldn't work out how to get jest-babel to transpile that to a common-js equivalent (\_\_dirname)
     - ts-jest also offers [some advantages](https://jestjs.io/docs/en/getting-started#using-typescript) of babel-jest

### folder structure

- ./src: our typescript source code and unit tests for it
  - ./src/server: code can only rely on running in the node-runtime environment, built directly with typescript compiler (tsc)
  - ./src/client: code can only rely on running in a browser, built with webpack
  - ./src/shared: code must be able to run on both, used in both webpack and tsc builds
- ./assets: all non-js static files to server to clients, including templates that are modified during the build process.
- ./dist: After building, this contains all the code needed to run the server.
  - ./dist/public should contain all static assets that need to be served to clients
- ./integration_tests: jest tests for integration testing our api. Spins up the full server and connects to it as a client.
- ./secret: files that we can't leak to version control, just env files at the moment
- ./logs: logs generated by the server while running

## Resources

- [demo socket-io project](https://github.com/socketio/chat-example)
- [google maps api](https://developers.google.com/maps/documentation/javascript/examples/polyline-simple)
- [error reporting](https://sentry.io/organizations/photo-snipe/)

  - There's a bug where sentry sometimes labels events as happening days in the past.

    Don't know the cause but seen in error reporting in index.js. You can tell these events because the latency in their received and occurred times will be massive

CNAME'd to Cloudflare for forcing https and for caching under photo-assassin.prangten.com

## Run locally with robo players

spin up server:

```bash
sudo docker-compose -f ./docker-compose.yml -f ./docker-compose.dev.yml up
```

spin up game with robot players:

```bash
# add --prod to have bots connect to production instance
npm run-script bots -- --listen
```

Have robot players join a game you've already made:

```bash
npm run-script bots -- --game-code story-financial-street-able --clients passive
```

### Phone browser remote debugging

https://developer.mozilla.org/en-US/docs/Tools/about:debugging

- Run adb - [no install needed, just download and run it](https://askubuntu.com/a/964987)

```bash
sudo ./adb devices`
```

- [enable dev options on phone](https://developer.android.com/studio/debug/dev-options)
- plug phone in usb, aurthise debug, etc
- Find the device on about:debugging in firefox and connect
- connect to server using local network IP, like: https://192.168.8.117

## test structure/philosophy

Tests need to give us confidence that the deployed branch is bug free - enough confidence to invite X friends to a park and not worry about wasting everyones time if a bug blows up the game halfway though.

Integration test should test HTTP APIs and Socket APIs work and that sequential calls to our stateful APIs (i.e. by playing the game) work as expected.

We should have integration tests that call the exact functions use by the clients (browser and socket bots) to talk to the API.
Browser and socket bots should probably only share API calling code when browser code will be called from JS for JSON endpoints. Makes less sense for HTTP endpoints.
As a result, all code for talking to HTTP/Socket APIs should be in the shared folder.
Other integration tests should probably not use this same code - as it likely has different needs (ability to provide incorrect data to trigger errors for example)

We should pull any static URLs from html/css and confirm we have integration tests hitting those endpoints.

Integration tests should be runnable against the production environment to test the deployed version is working at any point.

Client unit tests should test JS logic but not HTTP/socket handling code
(that should be tests via the code shared with integration tests)
Client unit tests should test effects on webpage HTML.

Server unit tests should test JS logic but not HTTP/socket handling code

## Memory leak debugging

Run node with `--inspect` and go to chrome://inspect in chromium
You can then use chrome's debugger to examine the heap
Last leak was caused by logging entire Game instances on GPS update

## Cloudflare setup

We have a page rule to cache everything on storage-photo-assassin.prangten.com/\*
todo: commit a script that recreates all the cloudflare settings
