

'use strict';

var index = require('./index');
const assert = require('assert');

const {Builder, By} = require('selenium-webdriver');
const {Channel, Options} = require('selenium-webdriver/firefox');

function checkLog(message, otherKeys=new Map()){
  var currentLog = index.nextLog();
  assert.equal(currentLog["message"], message);
  for (let [key, value] of otherKeys) {
    assert.equal(currentLog[key], value);
  }
  return currentLog;
}

async function sendChatMessage(driver, gameCode, userId, userName, chatMessage){
  await driver.findElement(By.id('message')).sendKeys(chatMessage);
  await driver.findElement(By.id('send-message')).click();
  var log = checkLog("Chat message", new Map([
    ["gameCode", gameCode],
    ["userId", userId],
    ["username", userName],
    ["chatMessage", chatMessage],
  ]));
}

async function testSinglePlayerGame(driver) {
  try {
    await driver.get(`http://localhost:${index.port}`);
    await driver.findElement(By.id('make-game')).click();
    var log = checkLog("making game");
    var gameCode = log["gameCode"];
    var log = checkLog("Adding user to game", new Map([
      ["gameCode", gameCode]
    ]));
    var userId = log["userId"];
    var log = checkLog("Socket connected", new Map([
      ["gameCode", gameCode],
      ["userId", userId],
    ]));
    var userName = "player1";
    await driver.findElement(By.id('username')).sendKeys(userName);
    var chatMessage = "hello";
    await sendChatMessage(driver, gameCode, userId, userName, chatMessage);
    chatMessage = "@maketargets"
    await sendChatMessage(driver, gameCode, userId, userName, chatMessage);
    var log = checkLog("Making targets", new Map([
      ["gameCode", gameCode],
      ["gameState", index.TARGETS_MADE],
    ]));
    chatMessage = "@start";
    await sendChatMessage(driver, gameCode, userId, userName, chatMessage);
    var log = checkLog("Starting", new Map([
      ["gameCode", gameCode],
      ["gameState", index.IN_PLAY],
    ]));
    chatMessage = "@snipe";
    await sendChatMessage(driver, gameCode, userId, userName, chatMessage);
    var log = checkLog("Snipe", new Map([
      ["gameCode", gameCode],
      ["gameState", index.IN_PLAY],
    ]));
    var log = checkLog("Winner", new Map([
      ["gameCode", gameCode],
      ["gameState", index.NOT_STARTED],
    ]));
  } catch (ex) {
    console.log('An error occured! ' + ex);
    console.dir(ex);
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
