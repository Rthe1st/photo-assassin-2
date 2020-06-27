

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

function sleep(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

async function sendChatMessage(driver, gameCode, publicId, chatMessage){
  await driver.findElement(By.id('message')).sendKeys(chatMessage);
  await driver.findElement(By.id('send-message')).click();
  checkLog("Chat message", new Map([
    ["gameCode", gameCode],
    ["publicId", publicId],
    ["chatMessage", chatMessage],
  ]));
}

async function testMakingNewGameWhileInOne(driver) {
  index.setUpLogging('testMakingNewGameWhileInOne');
  try {
    await driver.get(`http://localhost:${index.port}`);
    
    await driver.findElement(By.id('make-game')).click();
    var log = checkLog("making game");
    var gameCode = log["gameCode"];
    var log = checkLog("Adding user to game", new Map([
      ["gameCode", gameCode]
    ]));
    var publicId = log["publicId"];
    
    await driver.get(`http://localhost:${index.port}`);

    checkLog("Redirect to existing game", new Map([
      ["gameCode", gameCode],
      ["publicId", publicId],
    ]));

    assert.equal(index.nextLog(), undefined);

  } catch (ex) {
    console.log('An error occurred! ' + ex);
    console.dir(ex);
  } finally {
    await driver.quit();
  }
}

async function testGameTimeout(driver) {
  index.setUpLogging('testGameTimeout');
  try {
    await driver.get(`http://localhost:${index.port}`);
    
    await driver.findElement(By.id('make-game')).click();
    var log = checkLog("making game");
    var gameCode = log["gameCode"];
    var log = checkLog("Adding user to game", new Map([
      ["gameCode", gameCode]
    ]));
    var publicId = log["publicId"];
    
    var chatMessage = "hello";
    await sendChatMessage(driver, gameCode, publicId, chatMessage);
    
    chatMessage = "@maketargets"
    await sendChatMessage(driver, gameCode, publicId, chatMessage);
    var log = checkLog("Making targets", new Map([
      ["gameCode", gameCode],
      ["gameState", index.TARGETS_MADE],
    ]));
    
    chatMessage = "@start 1";
    await sendChatMessage(driver, gameCode, publicId, chatMessage);
    var log = checkLog("Starting", new Map([
      ["gameCode", gameCode],
      ["gameState", index.IN_PLAY],
    ]));
    
    //todo: mock current time to make this more reliable
    // / reduce waiting time
    await sleep(1000);

    var log = checkLog("TimeUp", new Map([
      ["gameCode", gameCode],
      ["gameState", index.NOT_STARTED],
    ]));

    assert.equal(index.nextLog(), undefined);

  } catch (ex) {
    console.log('An error occured! ' + ex);
    console.dir(ex);
  } finally {
    await driver.quit();
  }
}

async function testSinglePlayerGame(driver) {
  index.setUpLogging('testSinglePlayerGame');
  try {
    await driver.get(`http://localhost:${index.port}`);
    
    await driver.findElement(By.id('make-game')).click();
    var log = checkLog("making game");
    var gameCode = log["gameCode"];
    var log = checkLog("Adding user to game", new Map([
      ["gameCode", gameCode]
    ]));
    var publicId = log["publicId"];
    
    var chatMessage = "hello";
    await sendChatMessage(driver, gameCode, publicId, chatMessage);
    
    chatMessage = "@maketargets"
    await sendChatMessage(driver, gameCode, publicId, chatMessage);
    var log = checkLog("Making targets", new Map([
      ["gameCode", gameCode],
      ["gameState", index.TARGETS_MADE],
    ]));
    
    chatMessage = "@start";
    await sendChatMessage(driver, gameCode, publicId, chatMessage);
    var log = checkLog("Starting", new Map([
      ["gameCode", gameCode],
      ["gameState", index.IN_PLAY],
    ]));
    
    chatMessage = "@snipe";
    await sendChatMessage(driver, gameCode, publicId, chatMessage);
    var log = checkLog("Snipe", new Map([
      ["gameCode", gameCode],
      ["gameState", index.IN_PLAY],
    ]));
    var log = checkLog("Winner", new Map([
      ["gameCode", gameCode],
      ["gameState", index.NOT_STARTED],
    ]));

  } catch (ex) {
    await driver.quit();
    throw ex;
  }
  await driver.quit();
}

async function testTwoGamesInARow(driver) {
  index.setUpLogging('testTwoGamesInARow');
  try {
    await driver.get(`http://localhost:${index.port}`);
    
    await driver.findElement(By.id('make-game')).click();
    var log = checkLog("making game");
    var gameCode = log["gameCode"];
    var log = checkLog("Adding user to game", new Map([
      ["gameCode", gameCode]
    ]));
    var publicId = log["publicId"];

    for(var i=0; i<2; i++){
      var chatMessage = "hello";
      await sendChatMessage(driver, gameCode, publicId, chatMessage);
      
      chatMessage = "@maketargets"
      await sendChatMessage(driver, gameCode, publicId, chatMessage);
      var log = checkLog("Making targets", new Map([
        ["gameCode", gameCode],
        ["gameState", index.TARGETS_MADE],
      ]));
      
      chatMessage = "@start";
      await sendChatMessage(driver, gameCode, publicId, chatMessage);
      var log = checkLog("Starting", new Map([
        ["gameCode", gameCode],
        ["gameState", index.IN_PLAY],
      ]));
      
      chatMessage = "@snipe";
      await sendChatMessage(driver, gameCode, publicId, chatMessage);
      var log = checkLog("Snipe", new Map([
        ["gameCode", gameCode],
        ["gameState", index.IN_PLAY],
      ]));
      var log = checkLog("Winner", new Map([
        ["gameCode", gameCode],
        ["gameState", index.NOT_STARTED],
      ]));
    }

  } catch (ex) {
    await driver.quit();
    throw ex;
  }
  await driver.quit();
}

function createDriver(channel) {
  let options = new Options()
    .setBinary(channel)
    .setPreference("permissions.default.geo", 1)
    .setPreference("geo.enabled", "true")
    // I think this only needs to be set because of a bug
    // in certain firefox builds
    // https://bugzilla.mozilla.org/show_bug.cgi?id=1627150
    .setPreference("geo.provider.network.url", "https://location.services.mozilla.com/v1/geolocate?key=%MOZILLA_API_KEY%");
  return new Builder().forBrowser('firefox').setFirefoxOptions(options).build();
}

async function runTests(){
  // I think this has a race condition with testSinglePlayerGame
  // but because the function uses `await` when connecting to the server
  // the server always seems to start before calls to the driver fail?
  //todo: include start server in chain, or make it async and await
  index.startServer();
  //todo: make drivers headless / can we reuse a single driver?
  //todo: make run in parallel (promise.all), needs loggers to be made not global
  try{
    await testMakingNewGameWhileInOne(createDriver(Channel.RELEASE));
    await testGameTimeout(createDriver(Channel.RELEASE));
    await testSinglePlayerGame(createDriver(Channel.RELEASE));
    await testTwoGamesInARow(createDriver(Channel.RELEASE));
  }catch(ex){
    console.log('An error occurred! ' + ex);
    console.dir(ex);
  }
  // todo: why does stop server hang and not close?
  // process.exit shouldn't be needed
  index.stopServer();
  console.log("all done");
  process.exit();
}

runTests();
