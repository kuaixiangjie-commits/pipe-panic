function applyShot(w, shot) {
  if (shot === 'play') {
    w.pipes[0].state = 'fixed';
    w.pipes[3].state = 'fixed';
    w.fixedInitial = 2;
    w.elapsed = 129;
    w.timeLeft = 51;
    w.water = 51;
    w.score = 450;
    w.wrenchUntil = 135;
    w.player.x = (20.5) * CONFIG.TILE;
    w.player.y = (15.5) * CONFIG.TILE;
  } else if (shot === 'end') {
    w.fixedInitial = 6;
    for (const p of w.pipes) {
      if (!p.spare) p.state = 'fixed';
    }
    w.water = 12;
    w.elapsed = 33.6;
    w.timeLeft = 146.4;
    w.score = 1630;
    w.timeBonus = 730;
    w.won = true;
    w.over = true;
  }
}
