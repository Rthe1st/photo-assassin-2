"use strict";
exports.__esModule = true;
exports.shuffle = void 0;
function shuffle(userList) {
    var _a;
    // inside-out fisher-yates
    // https://en.wikipedia.org/wiki/Fisher%E2%80%93Yates_shuffle
    // note: wiki says multiplying a float and rounding down can give bias
    var shuffled = [];
    for (var boundary = 0; boundary < userList.length; boundary += 1) {
        shuffled.push(userList[boundary]);
        var swapPosition = Math.floor(Math.random() * (boundary + 1));
        if (swapPosition != boundary) {
            _a = [shuffled[swapPosition], shuffled[boundary]], shuffled[boundary] = _a[0], shuffled[swapPosition] = _a[1];
        }
    }
    return shuffled;
}
exports.shuffle = shuffle;
