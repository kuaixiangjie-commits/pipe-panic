// Pipe Panic! — canvas rendering: rooms, water, pipes, pickups, the
// plumber, HUD, minimap, and the five screens. All art is hand-drawn
// shapes; nothing is loaded from the network.
import { CONFIG } from './config.js';
import * as MAP from './map.js';

const { COLS, ROWS, TILE, WIDTH, HEIGHT } = CONFIG;

function fmtTime(seconds) {
  const s = Math.max(0, Math.ceil(seconds));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

function drawRooms(ctx) {
  for (const room of MAP.ROOMS) {
    ctx.fillStyle = room.color;
    ctx.fillRect(room.x * TILE, room.y * TILE, room.w * TILE, room.h * TILE);
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    ctx.font = '13px system-ui, sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText(room.name, room.x * TILE + 8, room.y * TILE + 18);
  }
}

function drawWalls(ctx) {
  ctx.fillStyle = '#5d4a36';
  for (let ty = 0; ty < ROWS; ty++) {
    for (let tx = 0; tx < COLS; tx++) {
      if (MAP.isWallTile(tx, ty)) ctx.fillRect(tx * TILE, ty * TILE, TILE, TILE);
    }
  }
  // Wall caps: a lighter top edge so walls read as walls.
  ctx.fillStyle = 'rgba(255,255,255,0.12)';
  for (let ty = 0; ty < ROWS; ty++) {
    for (let tx = 0; tx < COLS; tx++) {
      if (MAP.isWallTile(tx, ty) && !MAP.isWallTile(tx, ty + 1)) {
        ctx.fillRect(tx * TILE, (ty + 1) * TILE - 4, TILE, 4);
      }
    }
  }
}

function drawFurniture(ctx) {
  for (const f of MAP.FURNITURE) {
    const x = f.x * TILE;
    const y = f.y * TILE;
    const w = f.w * TILE;
    const h = f.h * TILE;
    ctx.fillStyle = '#8a6d4b';
    ctx.fillRect(x + 2, y + 2, w - 4, h - 4);
    ctx.strokeStyle = '#6b4f30';
    ctx.lineWidth = 2;
    ctx.strokeRect(x + 2, y + 2, w - 4, h - 4);
    if (f.label === 'washer' || f.label === 'dryer') {
      ctx.fillStyle = '#cfd8dc';
      ctx.beginPath();
      ctx.arc(x + w / 2, y + h / 2, Math.min(w, h) / 2 - 4, 0, Math.PI * 2);
      ctx.fill();
    } else if (f.label === 'plant') {
      ctx.fillStyle = '#2e7d32';
      ctx.beginPath();
      ctx.arc(x + w / 2, y + h / 2, 10, 0, Math.PI * 2);
      ctx.fill();
    } else if (f.label === 'tv') {
      ctx.fillStyle = '#263238';
      ctx.fillRect(x + 4, y + 4, w - 8, h - 8);
    }
  }
}

function drawWater(ctx, w) {
  for (let ty = 0; ty < ROWS; ty++) {
    for (let tx = 0; tx < COLS; tx++) {
      const level = w.water[ty * COLS + tx];
      if (level <= 0.02) continue;
      const a = 0.2 + 0.55 * level;
      ctx.fillStyle = `rgba(30,110,200,${a.toFixed(2)})`;
      ctx.fillRect(tx * TILE + 1, ty * TILE + 1, TILE - 2, TILE - 2);
      if (level > 0.6) {
        ctx.fillStyle = 'rgba(180,220,255,0.5)';
        ctx.fillRect(tx * TILE + 8, ty * TILE + 8, 6, 6);
      }
    }
  }
}

function drawPipes(ctx, w) {
  for (const p of w.pipes) {
    // Pipe base.
    ctx.fillStyle = '#9e9e9e';
    ctx.beginPath();
    ctx.arc(p.x, p.y, 11, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#616161';
    ctx.lineWidth = 2;
    ctx.stroke();
    if (!p.fixed) {
      // Burst: red ring, warning mark, and a spray that shivers.
      ctx.strokeStyle = '#d32f2f';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(p.x, p.y, 14, 0, Math.PI * 2);
      ctx.stroke();
      const t = w.elapsed * 10 + p.id * 1.7;
      ctx.strokeStyle = 'rgba(120,190,255,0.9)';
      ctx.lineWidth = 2;
      for (let k = 0; k < 5; k++) {
        const a = (k / 5) * Math.PI * 2 + Math.sin(t) * 0.3;
        const r0 = 15;
        const r1 = 15 + 8 + Math.sin(t + k) * 3;
        ctx.beginPath();
        ctx.moveTo(p.x + Math.cos(a) * r0, p.y + Math.sin(a) * r0);
        ctx.lineTo(p.x + Math.cos(a) * r1, p.y + Math.sin(a) * r1);
        ctx.stroke();
      }
      ctx.fillStyle = '#d32f2f';
      ctx.font = 'bold 16px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('!', p.x, p.y + 1);
      // Repair progress ring.
      if (p.progress > 0) {
        ctx.strokeStyle = '#2e7d32';
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.arc(p.x, p.y, 18, -Math.PI / 2, -Math.PI / 2 + p.progress * Math.PI * 2);
        ctx.stroke();
      }
    } else {
      // Fixed: green check.
      ctx.fillStyle = '#2e7d32';
      ctx.beginPath();
      ctx.arc(p.x, p.y, 11, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(p.x - 5, p.y);
      ctx.lineTo(p.x - 1, p.y + 4);
      ctx.lineTo(p.x + 6, p.y - 4);
      ctx.stroke();
    }
  }
}

function drawPickups(ctx, w) {
  for (const pk of w.pickups) {
    if (pk.taken) continue;
    const bob = Math.sin(w.elapsed * 3 + pk.tx) * 2;
    const x = pk.x;
    const y = pk.y + bob;
    if (pk.kind === 'wrench') {
      ctx.strokeStyle = '#546e7a';
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.moveTo(x - 7, y + 7);
      ctx.lineTo(x + 7, y - 7);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(x + 7, y - 7, 5, 0, Math.PI * 2);
      ctx.stroke();
    } else if (pk.kind === 'coffee') {
      ctx.fillStyle = '#6d4c41';
      ctx.fillRect(x - 6, y - 5, 12, 12);
      ctx.fillStyle = '#d7ccc8';
      ctx.fillRect(x - 6, y - 7, 12, 3);
      ctx.strokeStyle = '#6d4c41';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(x + 7, y + 1, 4, -Math.PI / 2, Math.PI / 2);
      ctx.stroke();
    } else {
      // Rubber duck.
      ctx.fillStyle = '#ffeb3b';
      ctx.beginPath();
      ctx.arc(x, y + 2, 8, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.arc(x + 4, y - 5, 5, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#ff9800';
      ctx.beginPath();
      ctx.moveTo(x + 8, y - 6);
      ctx.lineTo(x + 13, y - 4);
      ctx.lineTo(x + 8, y - 2);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = '#212121';
      ctx.beginPath();
      ctx.arc(x + 5, y - 6, 1.5, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}

function drawPlayer(ctx, w) {
  const p = w.player;
  ctx.fillStyle = 'rgba(0,0,0,0.25)';
  ctx.beginPath();
  ctx.ellipse(p.x, p.y + 10, 12, 5, 0, 0, Math.PI * 2);
  ctx.fill();
  // Body: blue overalls.
  ctx.fillStyle = '#1565c0';
  ctx.beginPath();
  ctx.arc(p.x, p.y, 12, 0, Math.PI * 2);
  ctx.fill();
  // Head.
  ctx.fillStyle = '#ffcc9e';
  ctx.beginPath();
  ctx.arc(p.x, p.y - 4, 7, 0, Math.PI * 2);
  ctx.fill();
  // Red cap.
  ctx.fillStyle = '#d32f2f';
  ctx.beginPath();
  ctx.arc(p.x, p.y - 4, 7, Math.PI, 0);
  ctx.fill();
  ctx.fillRect(p.x - 7, p.y - 5, 14, 2);
  // Facing tick.
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.arc(p.x + p.dir * 8, p.y + 2, 2, 0, Math.PI * 2);
  ctx.fill();
}

function drawHud(ctx, w) {
  ctx.fillStyle = 'rgba(20,20,20,0.72)';
  ctx.fillRect(0, 0, WIDTH, 38);
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 19px system-ui, sans-serif';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  const fixed = w.pipes.filter((p) => p.fixed).length;
  ctx.fillText(`SCORE ${w.score}`, 14, 20);
  ctx.fillText(`TIME ${fmtTime(w.timeLeft)}`, 220, 20);
  ctx.fillText(`PIPES ${fixed}/${w.pipes.length}`, 380, 20);
  // Pressure gauge.
  const gx = 560;
  const gw = 220;
  ctx.fillStyle = '#424242';
  ctx.fillRect(gx, 12, gw, 14);
  const pw = Math.round((gw * w.pressure) / 100);
  ctx.fillStyle = w.pressure < 25 ? '#66bb6a' : w.pressure < 50 ? '#ffee58' : w.pressure < 75 ? '#ffa726' : '#ef5350';
  ctx.fillRect(gx, 12, pw, 14);
  ctx.fillStyle = '#ffffff';
  ctx.fillText(`${w.pressureTier} ${Math.round(w.pressure)}`, gx + gw + 10, 20);
  ctx.fillText(`WATER ${Math.round(w.coverage * 100)}%`, 950, 20);
  ctx.fillText(`DUCKS ${w.ducksGot}/3`, 1130, 20);
  if (w.elapsed < w.wrenchUntil) {
    ctx.fillStyle = '#90caf9';
    ctx.fillText(`WRENCH ${Math.ceil(w.wrenchUntil - w.elapsed)}s`, 1290, 20);
  }
  if (w.elapsed < w.coffeeUntil) {
    ctx.fillStyle = '#ffcc80';
    ctx.fillText(`COFFEE ${Math.ceil(w.coffeeUntil - w.elapsed)}s`, 1440, 20);
  }
  // Toast message.
  if (w.message && w.elapsed < w.messageUntil) {
    ctx.font = 'bold 20px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillStyle = 'rgba(20,20,20,0.7)';
    const tw = ctx.measureText(w.message).width + 28;
    ctx.fillRect((WIDTH - tw) / 2, 48, tw, 32);
    ctx.fillStyle = '#fff176';
    ctx.fillText(w.message, WIDTH / 2, 65);
  }
}

function drawMinimap(ctx, w) {
  const scale = 0.11;
  const mw = COLS * TILE * scale;
  const mh = ROWS * TILE * scale;
  const ox = WIDTH - mw - 14;
  const oy = HEIGHT - mh - 14;
  ctx.fillStyle = 'rgba(20,20,20,0.6)';
  ctx.fillRect(ox - 4, oy - 4, mw + 8, mh + 8);
  for (const room of MAP.ROOMS) {
    ctx.fillStyle = '#9e9e9e';
    ctx.fillRect(ox + room.x * TILE * scale, oy + room.y * TILE * scale, room.w * TILE * scale, room.h * TILE * scale);
  }
  for (let ty = 0; ty < ROWS; ty++) {
    for (let tx = 0; tx < COLS; tx++) {
      if (w.water[ty * COLS + tx] > CONFIG.WATER_COVER_THRESHOLD) {
        ctx.fillStyle = '#1e78c8';
        ctx.fillRect(ox + tx * TILE * scale, oy + ty * TILE * scale, TILE * scale, TILE * scale);
      }
    }
  }
  for (const p of w.pipes) {
    ctx.fillStyle = p.fixed ? '#66bb6a' : '#ef5350';
    ctx.beginPath();
    ctx.arc(ox + p.x * scale, oy + p.y * scale, 3, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.arc(ox + w.player.x * scale, oy + w.player.y * scale, 3.5, 0, Math.PI * 2);
  ctx.fill();
}

function overlay(ctx, title, lines, accent) {
  ctx.fillStyle = 'rgba(15,15,25,0.72)';
  ctx.fillRect(0, 0, WIDTH, HEIGHT);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = accent;
  ctx.font = 'bold 72px system-ui, sans-serif';
  ctx.fillText(title, WIDTH / 2, HEIGHT / 2 - 130);
  ctx.fillStyle = '#ffffff';
  ctx.font = '24px system-ui, sans-serif';
  lines.forEach((line, i) => {
    ctx.fillText(line, WIDTH / 2, HEIGHT / 2 - 50 + i * 38);
  });
}

export function render(ctx, w) {
  ctx.clearRect(0, 0, WIDTH, HEIGHT);
  ctx.fillStyle = '#3e3226';
  ctx.fillRect(0, 0, WIDTH, HEIGHT);
  drawRooms(ctx);
  drawWalls(ctx);
  drawFurniture(ctx);
  drawWater(ctx, w);
  drawPipes(ctx, w);
  drawPickups(ctx, w);
  drawPlayer(ctx, w);
  drawHud(ctx, w);
  drawMinimap(ctx, w);

  if (w.screen === 'title') {
    overlay(
      ctx,
      'PIPE PANIC!',
      [
        'One rainy night in Copperton, every pipe in Harborview Apartments burst at once.',
        'You are Pip Calloway, the plumber on call. Fix all 6 burst pipes before your 180-second shift ends.',
        '',
        'WASD / arrows — move    Hold E — repair a pipe, or mop up water',
        'P / Esc — pause    Wrench repairs 2x faster    Coffee makes you faster    Ducks are +50',
        'If standing water covers 75% of the floor, the building floods.',
        '',
        `Best score: ${w.best}`,
        'Press SPACE to start',
      ],
      '#ffca28',
    );
  } else if (w.screen === 'paused') {
    overlay(ctx, 'PAUSED', ['Press P or Esc to get back to work.'], '#90caf9');
  } else if (w.screen === 'win') {
    overlay(
      ctx,
      'SHIFT COMPLETE!',
      [
        `All 6 pipes fixed with ${fmtTime(w.timeLeft)} to spare.`,
        `Score: ${w.score}    Best: ${w.best}`,
        '',
        'Press SPACE to play again',
      ],
      '#66bb6a',
    );
  } else if (w.screen === 'lose') {
    overlay(
      ctx,
      w.loseReason === 'flood' ? 'THE BUILDING FLOODED' : 'OUT OF TIME',
      [
        w.loseReason === 'flood'
          ? 'Standing water covered 75% of the floor.'
          : 'The 180-second shift ran out with pipes still burst.',
        `Score: ${w.score}    Best: ${w.best}`,
        '',
        'Press SPACE to try again',
      ],
      '#ef5350',
    );
  }
}
