# Photo Assassin 2

This project is an app to make playing [Photo Assassin](https://github.com/Rthe1st/photo_assassin) more fun.

## Resources

* [Deployment](https://dashboard.heroku.com/apps/photo-assassin/deploy/github)
* [demo socket-io project](https://github.com/socketio/chat-example)
* [google maps api](https://developers.google.com/maps/documentation/javascript/examples/polyline-simple)

## Run locally

```bash
node ./index.js
```

### Selinium

You need [geckodriver](https://github.com/mozilla/geckodriver/releases/)

```bash
wget https://github.com/mozilla/geckodriver/releases/download/v0.24.0/geckodriver-v0.24.0-linux64.tar.gz
tar -xvzf geckodriver*
mv geckodriver /usr/local/bin/
```

To test, first start the sever in one terminal:

```bash
node ./index.js
```

Then test with:

```bash
node selenium_test.js
```
