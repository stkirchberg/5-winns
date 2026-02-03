function key(x, y) { return x + ',' + y; }

function checkWinLine(x, y, player, board) {
  const dirs = [[1, 0], [0, 1], [1, 1], [1, -1]];
  for (const [dx, dy] of dirs) {
    let line = [{ x, y }];

    for (let s = 1; s < 5; s++) {
      if (board.get(key(x + dx * s, y + dy * s)) === player) line.push({ x: x + dx * s, y: y + dy * s });
      else break;
    }
    for (let s = 1; s < 5; s++) {
      if (board.get(key(x - dx * s, y - dy * s)) === player) line.unshift({ x: x - dx * s, y: y - dy * s });
      else break;
    }
    if (line.length >= 5) return line.slice(0, 5);
  }
  return null;
}

module.exports = { checkWinLine, key };