# Photo Assassin 2

This project is an app to make playing [Photo Assassin](https://github.com/Rthe1st/photo_assassin) more fun.


## Build process

We need to support running code in 3 enviroments

1) node (for server code)
2) in the browser via webpack
3) In Jest

Node requires imports to include .js explicitly
but webpack/ts-loader cannot map a .js import to it's .js file
Jester needs commonjs code

Solution:

Do not use .js in typescript imports
when transpiling server code, append .js to local import paths
    (with a transform or with seperate script after)
Webpack should just work
Use babel to transform typescript into common js for jester
Run tsc on the jester tests to validate their types
    Jester suport for esmodules is comming in next major release 0.27.0
    when that is out we should switch to ts-jester + jester over babel + jester

Also ./client should only be for code running in a browser
bots (clients running in node) should be in ./server
./shared code should run in both runtime enviroments

## Resources

We have to include .js extensions in module import paths because of this
https://github.com/microsoft/TypeScript/issues/40878
which seems crazy but :shrug:

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
