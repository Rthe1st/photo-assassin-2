

'use strict';

var index = require('./index');

const {Builder, By} = require('selenium-webdriver');
const {Channel, Options} = require('selenium-webdriver/firefox');

async function testSinglePlayerGame(driver) {
  try {
    await driver.get(`http://localhost:${index.port}`)
    await driver.findElement(By.id('make-game')).click();
    await driver.findElement(By.id('username')).sendKeys("player1");
    await driver.findElement(By.id('message')).sendKeys("hello");
    await driver.findElement(By.id('send-message')).click();
    await driver.findElement(By.id('message')).sendKeys("@maketargets");
    await driver.findElement(By.id('send-message')).click();
    await driver.findElement(By.id('message')).sendKeys("@start");
    await driver.findElement(By.id('send-message')).click();
    await driver.findElement(By.id('message')).sendKeys("@snipe");
    await driver.findElement(By.id('send-message')).click();
  } catch (ex) {
    console.log('An error occured! ' + ex);
  } finally {
    await driver.quit();
  }
}

function createDriver(channel) {
  let options = new Options().setBinary(channel);
  return new Builder().forBrowser('firefox').setFirefoxOptions(options).build();
}

// I think this has a race condition with testSinglePlayerGame
// but because the function uses `await` when connecting to the server
// the server always seems to start before calls to the driver fail?
index.startServer();

Promise.all([
  testSinglePlayerGame(createDriver(Channel.RELEASE)),
]).then(_ => {
  console.log('All done!');
  index.stopServer();
}, err => {
  console.error('An error occured! ' + err);
  setTimeout(() => {throw err}, 0);
});
