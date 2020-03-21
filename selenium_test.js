

'use strict';

const {Builder, By} = require('selenium-webdriver');
const {Channel, Options} = require('selenium-webdriver/firefox');

async function testSinglePlayerGame(driver) {
  try {
    // Start on the base about page.
    await driver.get('http://localhost:3000')
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

Promise.all([
  testSinglePlayerGame(createDriver(Channel.RELEASE)),
]).then(_ => {
  console.log('All done!');
}, err => {
  console.error('An error occured! ' + err);
  setTimeout(() => {throw err}, 0);
});