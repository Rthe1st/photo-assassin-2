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

build browser js

```bash
npm build
```

```bash
nodejs ./server.js
```

It'll be running on [localhost](http://localhost:3000/)
