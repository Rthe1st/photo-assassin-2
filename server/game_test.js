import * as Game from './game.js';

export function basicGame(){
    var game = Game.newGame("fakegamecode");
    const [privateId, publicId] = Game.addPlayer(game, "player1");
    Game.removePlayer(game, publicId);
    const [privateId2, publicId2] = Game.addPlayer(game, "player2");
    const [privateId3, publicId3] = Game.addPlayer(game, "player3");
    const [privateId4, publicId4] = Game.addPlayer(game, "player4");
    Game.makeTargets(game, 60, 10);
    Game.undoMakeTargets(game);
    Game.makeTargets(game, 40, 5);
    Game.start(game);
    Game.updatePosition(game, publicId2, {longitude: 1, latitude: 1});
    var snipeRes = Game.snipe(game, publicId2);
    // publicId2 is undoing their own snipe
    Game.badSnipe(game, publicId2, snipeRes.snipeNumber, publicId2);
    var snipeRes = Game.snipe(game, publicId2);
    var snipeRes = Game.snipe(game, publicId2);
    if (snipeRes.gameOver) {
        Game.finishGame(game, publicId);
        console.log("game over, success!");
    } else {
        console.log("game not over, fail :(");
    }
}
