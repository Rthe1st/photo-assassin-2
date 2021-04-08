import * as Game from './game';
import * as fs from 'fs'
import * as logging from './logging'

test('basic game', async () => {
    logging.setupJestLogging();
    var game = Game.newGame("fake-game-code");
    const { publicId: publicId } = Game.addPlayer(game, "player1");
    Game.removePlayer(game, publicId);
    const { publicId: publicId2 } = Game.addPlayer(game, "player2");
    Game.addPlayer(game, "player3");
    Game.addPlayer(game, "player4");
    Game.updateSettings(game, 40, 5, game.chosenSettings!.proposedTargetList);
    Game.start(game);
    let position = {
        longitude: 1,
        latitude: 1,
        accuracy: null,
        heading: null,
        speed: null,
        timestamp: null,
        altitude: null,
        altitudeAccuracy: null
    }
    Game.updatePosition(game, publicId2, position);
    var photo = fs.readFileSync('./src/server/sample_snipe_image.jpeg');
    let {imageId: imageId1, imagePromise: ip, resizePromise: resizePromise} = Game.saveImage(game, photo);

    await ip;
    await resizePromise;

    let {snipeInfo: snipeInfo} = Game.snipe(game, publicId2, imageId1);
    // publicId2 is undoing their own snipe
    let undoneSnipes = Game.badSnipe(game, snipeInfo.index, publicId2);
    expect(undoneSnipes).toEqual([0]);
    let {imageId: imageId2} = Game.saveImage(game, photo);
    var snipeRes = Game.snipe(game, publicId2, imageId2);
    let {imageId: imageId3} = Game.saveImage(game, photo);
    var snipeRes = Game.snipe(game, publicId2, imageId3);
    expect(snipeRes.gameOver).toBeTruthy();
    Game.finishGame(game, "made-up-code", publicId.toString());
})

// todo: should test that no 2 games can generate the same code
// test("test game ID", ()=>{
//     expect(Game.generateGame(1)).toEqual(Game.generateGame(1));
//     expect(Game.generateGame(1)).not.toEqual(Game.generateGame(2));
// })

