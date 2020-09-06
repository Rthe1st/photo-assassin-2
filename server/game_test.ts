import * as Game from './game.js';

export function basicGame(){
    var game = Game.newGame("fakegamecode");
    const {privateId: privateId, publicId: publicId} = Game.addPlayer(game, "player1");
    Game.removePlayer(game, publicId);
    const {privateId: privateId2, publicId: publicId2} = Game.addPlayer(game, "player2");
    const {privateId: privateId3, publicId: publicId3} = Game.addPlayer(game, "player3");
    const {privateId: privateId4, publicId: publicId4} = Game.addPlayer(game, "player4");
    Game.makeTargets(game, "60", "10", game.chosenSettings.proposedTargetList.map((v) => v.toString()));
    Game.undoMakeTargets(game);
    Game.makeTargets(game, "40", "5", game.chosenSettings.proposedTargetList.map((v) => v.toString()));
    Game.start(game);
    Game.updatePosition(game, publicId2, {longitude: 1, latitude: 1});
    var snipeRes = Game.snipe(game, publicId2);
    // publicId2 is undoing their own snipe
    Game.badSnipe(game, publicId2, snipeRes.snipeNumber, publicId2);
    var snipeRes = Game.snipe(game, publicId2);
    var snipeRes = Game.snipe(game, publicId2);
    if (snipeRes.gameOver) {
        Game.finishGame(game, publicId.toString(), undefined);
        console.log("game over, success!");
    } else {
        console.log("game not over, fail :(");
    }
}
