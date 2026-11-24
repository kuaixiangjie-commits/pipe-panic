function render(ctx, w, screen) {
  const T = CONFIG.TILE;
  ctx.clearRect(0, 0, CONFIG.WIDTH, CONFIG.HEIGHT);

  for (const room of ROOMS) {
    ctx.fillStyle = room.color;
    ctx.fillRect(room.x * T, room.y * T, room.w * T, room.h * T);
    ctx.fillStyle = 'rgba(0,0,0,0.45)';
    ctx.font = 'bold 15px sans-serif';
    ctx.fillText(room.name, room.x * T + 10, room.y * T + 22);
  }

  for (let ty = 0; ty < CONFIG.ROWS; ty++) {
    for (let tx = 0; tx < CONFIG.COLS; tx++) {
      if (isWetTile(w, tx, ty)) {
        ctx.fillStyle = 'rgba(40,110,220,0.35)';
        ctx.fillRect(tx * T, ty * T, T, T);
      }
    }
  }

  for (const f of FURNITURE) {
    ctx.fillStyle = f.color;
    ctx.fillRect(f.x * T + 2, f.y * T + 2, f.w * T - 4, f.h * T - 4);
    ctx.fillStyle = 'rgba(255,255,255,0.75)';
    ctx.font = '11px sans-serif';
    ctx.fillText(f.label, f.x * T + 6, f.y * T + f.h * T - 6);
  }

  ctx.fillStyle = '#3a3f46';
  w.map.walls.forEach((k) => {
    const [tx, ty] = k.split(',').map(Number);
    ctx.fillRect(tx * T, ty * T, T, T);
  });

  for (const p of w.pipes) {
    const cx = p.x * T + T / 2;
    const cy = p.y * T + T / 2;
    if (p.state === 'burst') {
      ctx.fillStyle = '#1d6fd1';
      ctx.beginPath();
      ctx.arc(cx, cy, 13, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#9ecfff';
      ctx.lineWidth = 3;
      for (let i = 0; i < 5; i++) {
        const a = (i / 5) * Math.PI * 2 + w.elapsed * 2;
        ctx.beginPath();
        ctx.moveTo(cx, cy);
        ctx.lineTo(cx + Math.cos(a) * 22, cy + Math.sin(a) * 22);
        ctx.stroke();
      }
      ctx.fillStyle = '#fff';
      ctx.font = 'bold 12px sans-serif';
      ctx.fillText('!', cx - 3, cy + 4);
    } else if (p.state === 'fixed') {
      ctx.fillStyle = '#5a9e4b';
      ctx.beginPath();
      ctx.arc(cx, cy, 11, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#fff';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.moveTo(cx - 5, cy);
      ctx.lineTo(cx - 1, cy + 5);
      ctx.lineTo(cx + 6, cy - 5);
      ctx.stroke();
    } else {
      ctx.fillStyle = '#8a939c';
      ctx.beginPath();
      ctx.arc(cx, cy, 9, 0, Math.PI * 2);
      ctx.fill();
    }
    if (p.state === 'burst' && p.progress > 0) {
      ctx.fillStyle = '#222';
      ctx.fillRect(cx - 16, cy - 24, 32, 6);
      ctx.fillStyle = '#ffd23e';
      ctx.fillRect(cx - 15, cy - 23, 30 * p.progress, 4);
    }
  }

  if (!w.wrenchTaken) {
    const wx = PICKUP_SPOTS.wrench.x * T + T / 2;
    const wy = PICKUP_SPOTS.wrench.y * T + T / 2;
    ctx.fillStyle = '#ffd23e';
    ctx.beginPath();
    ctx.arc(wx, wy, 12, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#222';
    ctx.font = 'bold 13px sans-serif';
    ctx.fillText('W', wx - 5, wy + 5);
  }
  if (!w.coffeeTaken) {
    const cx = PICKUP_SPOTS.coffee.x * T + T / 2;
    const cy = PICKUP_SPOTS.coffee.y * T + T / 2;
    ctx.fillStyle = '#7a4a21';
    ctx.beginPath();
    ctx.arc(cx, cy, 12, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 13px sans-serif';
    ctx.fillText('C', cx - 5, cy + 5);
  }
  PICKUP_SPOTS.ducks.forEach((d, i) => {
    if (w.ducksTaken[i]) return;
    const dx = d.x * T + T / 2;
    const dy = d.y * T + T / 2;
    ctx.fillStyle = '#ffe14d';
    ctx.beginPath();
    ctx.arc(dx, dy, 10, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#ff8c1a';
    ctx.beginPath();
    ctx.moveTo(dx + 8, dy - 2);
    ctx.lineTo(dx + 15, dy + 2);
    ctx.lineTo(dx + 8, dy + 5);
    ctx.fill();
    ctx.fillStyle = '#222';
    ctx.beginPath();
    ctx.arc(dx + 3, dy - 3, 1.8, 0, Math.PI * 2);
    ctx.fill();
  });

  const p = w.player;
  ctx.fillStyle = '#e86a1c';
  ctx.beginPath();
  ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#2b6fd1';
  ctx.beginPath();
  ctx.arc(p.x, p.y - 4, 10, Math.PI, 0);
  ctx.fill();
  ctx.fillRect(p.x - 10, p.y - 6, 20, 4);
  ctx.fillStyle = '#222';
  ctx.beginPath();
  ctx.arc(p.x - 4, p.y + 2, 2, 0, Math.PI * 2);
  ctx.arc(p.x + 4, p.y + 2, 2, 0, Math.PI * 2);
  ctx.fill();

  if (w.water > 0.5) {
    ctx.fillStyle = 'rgba(30,100,220,' + Math.min(0.28, w.water / 100 * 0.28) + ')';
    ctx.fillRect(0, 0, CONFIG.WIDTH, CONFIG.HEIGHT);
  }

  drawHud(ctx, w);
  drawMinimap(ctx, w);

  if (screen === 'title') drawTitle(ctx, w);
  else if (screen === 'paused') drawOverlay(ctx, 'PAUSED', 'Press P to resume');
  else if (screen === 'win') drawEnd(ctx, w, true);
  else if (screen === 'lose') drawEnd(ctx, w, false);
}

function drawHud(ctx, w) {
  ctx.fillStyle = 'rgba(15,18,24,0.92)';
  ctx.fillRect(0, 0, CONFIG.WIDTH, 46);
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 20px sans-serif';
  const mins = Math.floor(w.timeLeft / 60);
  const secs = Math.floor(w.timeLeft % 60);
  const timeStr = mins + ':' + String(secs).padStart(2, '0');
  const tier = tierFor(w.elapsed);
  ctx.fillText('SCORE ' + w.score, 16, 31);
  ctx.fillText('TIME ' + timeStr, 220, 31);
  ctx.fillText('PIPES ' + w.fixedInitial + '/6', 420, 31);
  ctx.fillStyle = w.water >= 60 ? '#ff5a4d' : '#fff';
  ctx.fillText('WATER ' + Math.floor(w.water) + '%', 600, 31);
  ctx.fillStyle = tier.name === 'FLOODING' ? '#ff5a4d' : tier.name === 'RUSH' ? '#ffb13e' : '#fff';
  ctx.fillText(tier.name, 800, 31);
  ctx.fillStyle = '#ffd23e';
  if (w.elapsed < w.wrenchUntil) ctx.fillText('WRENCH ' + Math.ceil(w.wrenchUntil - w.elapsed) + 's', 980, 31);
  if (w.elapsed < w.coffeeUntil) ctx.fillText('COFFEE ' + Math.ceil(w.coffeeUntil - w.elapsed) + 's', 1140, 31);
  ctx.fillStyle = '#ffe14d';
  ctx.fillText('DUCKS ' + w.ducksGot + '/3', 1330, 31);
}

function drawMinimap(ctx, w) {
  const mw = 200;
  const mh = 150;
  const mx = CONFIG.WIDTH - mw - 14;
  const my = CONFIG.HEIGHT - mh - 14;
  const sx = mw / CONFIG.WIDTH;
  const sy = mh / CONFIG.HEIGHT;
  ctx.fillStyle = 'rgba(15,18,24,0.85)';
  ctx.fillRect(mx, my, mw, mh);
  for (const room of ROOMS) {
    ctx.fillStyle = room.color;
    ctx.fillRect(mx + room.x * CONFIG.TILE * sx, my + room.y * CONFIG.TILE * sy, room.w * CONFIG.TILE * sx, room.h * CONFIG.TILE * sy);
  }
  for (const p of w.pipes) {
    if (p.state !== 'burst') continue;
    ctx.fillStyle = '#ff2e1f';
    ctx.beginPath();
    ctx.arc(mx + (p.x + 0.5) * CONFIG.TILE * sx, my + (p.y + 0.5) * CONFIG.TILE * sy, 3.5, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.fillStyle = '#fff';
  ctx.beginPath();
  ctx.arc(mx + w.player.x * sx, my + w.player.y * sy, 3.5, 0, Math.PI * 2);
  ctx.fill();
}

function drawTitle(ctx, w) {
  ctx.fillStyle = 'rgba(10,12,18,0.72)';
  ctx.fillRect(0, 0, CONFIG.WIDTH, CONFIG.HEIGHT);
  ctx.fillStyle = '#ffd23e';
  ctx.font = 'bold 84px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('PIPE PANIC!', CONFIG.WIDTH / 2, 420);
  ctx.fillStyle = '#fff';
  ctx.font = '28px sans-serif';
  ctx.fillText('Harborview Apartments is flooding. You are Pip Calloway, the plumber on call.', CONFIG.WIDTH / 2, 500);
  ctx.fillText('Fix all 6 burst pipes before the water hits 75% — or the clock runs out.', CONFIG.WIDTH / 2, 545);
  ctx.font = '24px sans-serif';
  ctx.fillText('Move: WASD / Arrows    Repair & mop: hold E    Pause: P', CONFIG.WIDTH / 2, 630);
  ctx.fillStyle = '#ffd23e';
  ctx.font = 'bold 30px sans-serif';
  ctx.fillText('Press ENTER to start your shift', CONFIG.WIDTH / 2, 720);
  ctx.textAlign = 'left';
}

function drawOverlay(ctx, title, sub) {
  ctx.fillStyle = 'rgba(10,12,18,0.6)';
  ctx.fillRect(0, 0, CONFIG.WIDTH, CONFIG.HEIGHT);
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 64px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(title, CONFIG.WIDTH / 2, 560);
  ctx.font = '28px sans-serif';
  ctx.fillText(sub, CONFIG.WIDTH / 2, 620);
  ctx.textAlign = 'left';
}

function drawEnd(ctx, w, won) {
  ctx.fillStyle = 'rgba(10,12,18,0.72)';
  ctx.fillRect(0, 0, CONFIG.WIDTH, CONFIG.HEIGHT);
  ctx.fillStyle = won ? '#7ddc5a' : '#ff5a4d';
  ctx.font = 'bold 76px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(won ? 'SHIFT SAVED!' : 'FLOODED OUT!', CONFIG.WIDTH / 2, 460);
  ctx.fillStyle = '#fff';
  ctx.font = '30px sans-serif';
  ctx.fillText('Score: ' + w.score + '   Pipes fixed: ' + w.fixedInitial + '/6   Ducks: ' + w.ducksGot + '/3', CONFIG.WIDTH / 2, 540);
  if (won) ctx.fillText('Time bonus: +' + w.timeBonus + '   Best: ' + (localStorage.getItem('pipe-panic-best') || w.score), CONFIG.WIDTH / 2, 590);
  else ctx.fillText(w.loseReason === 'flood' ? 'The water hit 75%. Harborview needs a new plumber.' : 'The clock ran out with pipes still bursting.', CONFIG.WIDTH / 2, 590);
  ctx.fillStyle = '#ffd23e';
  ctx.font = 'bold 28px sans-serif';
  ctx.fillText('Press R to play again', CONFIG.WIDTH / 2, 680);
  ctx.textAlign = 'left';
}
