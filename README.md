# Photo Assassin 2

This project is an app to make playing [Photo Assassin](https://github.com/Rthe1st/photo_assassin) more fun.

## Deployment

We deploy to heroku using docker image built with github actions.

https://devcenter.heroku.com/articles/container-registry-and-runtime#testing-an-image-locally

When adding config vars, use real spaces instead of \n. This is important for GCP_PRIVATE_KEY

### Testing the docker image locally

```bash
sudo docker build . -t photo-assassin
sudo docker run --name photo-assassin -p 3000:3000 --env-file .env --volume=`pwd`/secret:/home/node/app/secret photo-assassin
```

To test code changes without rebuilding the image all the time:

```bash
npm run-script build
sudo docker run --name photo-assassin -p 3000:3000 --env-file .env --volume=`pwd`/secret:/home/node/app/secret --volume=`pwd`/dist:/home/node/app/dist photo-assassin
```

Kill/clean up container

```bash
# todo: why does adding -t -i to docker run not let ctl+c kill container?
sudo docker rm photo-assassin -f
```

### Deploying manually

```bash
docker login --username=$USERNAME registry.heroku.com
docker tag photo-assassin registry.heroku.com/photo-assassin/web
docker push registry.heroku.com/photo-assassin/web
```

## Build process

We build for 3 situations, starting from typescript source code and es6 module syntax preferred over commonjs.

1) code to be run with node

    * compile typescript files into Javascript
        * build with `tsc`
    * support use of import.metadata.url by running as es6 modules
        * set `"type": "module"` in package.json
        * https://nodejs.org/api/esm.html#esm_enabling
    * Node requires explicit .js extensions on imports, and typescript does not add these
        * use [a transform](https://github.com/Zoltu/typescript-transformer-append-js-extension) to add them
        * don't add .js extensions explicitly to typescript source. We have shared code that is used in both node and browser contexts (and just-for-node code must build with jest for testing). tsc can resolve explicit .js import to .ts files but webpack + ts-awesome-loader and jest + test-jest cannot (couldn't find good reference for why/if that is a bug)
            * https://github.com/Microsoft/TypeScript/issues/16577
    * tsc doesn't support plugin configuration in tsconfig.json
        * use `ttsc` when buidling for node, which support a `plugins` key for tsconfig
    * Output the compiled JS to a new directory so it's harder for any tooling to accidentally start resolving to js version of a file instead of the ts version
2) code to be run in a browser
    * bundle JS dependencies / build static assets from templates
    * use webpack
    * compile typescript files into Javascript
        * use ts-awesome-loader webpack plugin
        * as noted above, webpack + ts-awesome-loader means we can't use explicit .js extensions in imports
3) code to be run in Jest tests
    * compile typescript files into Javascript
        * ts-jest jest transform
        * as noted above, jest + ts-jest means we can't use explicit .js extensions in imports
    * use es6 module syntax like import.metadata.url
        * Current stable ts-jest (v26) does not support es6 module code, so we use v27-next and config to force jest/ts-jest into es6 module mode
            * https://jestjs.io/docs/en/ecmascript-modules
            * https://kulshekhar.github.io/ts-jest/docs/next/guides/esm-support
        * I couldn't work out how to get jest-babel to transpile that to a common-js equivalent (__dirname)
        * ts-jest also offers [some advantages](https://jestjs.io/docs/en/getting-started#using-typescript) of babel-jest

We could of solved the .js -> .ts resolution problem by specifying .js in typescript imports and stripping the extension with webpack/jest transforms. Its a choice between using webpack and jest transforms to strip it vs a tsc transform to add it and ttsc to use the plugin.

Solving this took me forever and I don't understand why this isn't a more common problem. I suppose code that uses typescript + es6 syntax + jest + webpack + runs in node such a niche setup? I feel like I must be missing a bigger architecure problem or something.

Our jest setup doesn't support testing of ./src/client scripts yet, we need to add a jest config for that

### folder structure

* ./src: our typescript source code and unit tests for it (when I write some - lul)

  * ./src/server: code can only rely on running in the node-runtime environment, built with `ttsc`
  * ./src/client: code can only rely on running in a browser, built with webpack
  * ./src/shared: code must be able to run on both, used in both webpack and ttsc builds

  * ./src/shared code causes the mess with import extensions - when running in node, we must specify .js, when in webpack/jest we must not specify it. Oh my.

* ./assets: all non-js static files to server to clients, including templates that are modified during the build process.

* ./dist: After building, this contains all the code needed to run the server.
  * ./dist/public should contain all static assets that need to be served to clients

* ./integration_tests: jest tests for integration testing our api. Spins up the full server and connects to it as a client.

* ./secret: files that we can't leak to version control, api keys, certificate keys

* ./logs: logs generated by the server while running

## Resources

* [Deployment](https://dashboard.heroku.com/apps/photo-assassin/deploy/github)
* [demo socket-io project](https://github.com/socketio/chat-example)
* [google maps api](https://developers.google.com/maps/documentation/javascript/examples/polyline-simple)
* [error reporting](https://sentry.io/organizations/photo-snipe/)
  * There's a bug where sentry sometimes labels events as happening days in the past.

    Don't know the cause but seen in error reporting in index.js. You can tell these events because the latency in their received and occurred times will be massive

CNAME'd to Cloudflare for forcing https and for caching under photo-assassin.prangten.com

## Run locally

test:

```bash
npm test
```

Integration tests require you to spin up a server yourself
because I can't get globalsetup to work with jest (more notes in the jest config file).

```bash
# in one terminal
npm run-script start
# in another
npm run-script integration-test
```

build:

```bash
npm run prepublish
```

spin up server:

```bash
npm start
```

spin up game with robot players:

```bash
# add --prod to run the game on prod instead
npm start -- --clients listen
```

Have robot players join a game you've already made:

```bash
npm run-script start -- --game-code you-game-code-here --clients passive
```

It'll be running on [localhost](http://localhost:3000/)

### Phone browser remote debugging

https://developer.mozilla.org/en-US/docs/Tools/about:debugging

* Run adb - [no install needed, just download and run it](https://askubuntu.com/a/964987)

```bash
sudo ./adb devices`
```

* [enable dev options on phone](https://developer.android.com/studio/debug/dev-options)
* plug phone in usb, aurthise debug, etc
* Find the device on about:debugging in firefox and connect
* connect to server using local network IP, like: http://192.168.8.117:3000

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

We have a page rule to cache everything on storage-photo-assassin.prangten.com/*
todo: commit a script that recreates all the cloudflare settings
