# Photo Assassin 2

This project is an app to make playing [Photo Assassin](https://github.com/Rthe1st/photo_assassin) more fun.

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
