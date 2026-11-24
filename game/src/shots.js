// Deterministic staged scenes for screenshots: ?shot=start|play|end&seed=N.
import { CONFIG } from './config.js';
import { createWorld, computeCoverage } from './world.js';
import * as MAP from './map.js';

const { COLS, ROWS, TILE } = CONFIG;

function paintWaterBlob(w, tx, ty, radius, level) {
  for (let y = ty - radius; y <= ty + radius; y++) {
    for (let x = tx - radius; x <= tx + radius; x++) {
      if (x < 0 || y < 0 || x >= COLS || y >= ROWS) continue;
      if (MAP.isWallTile(x, y)) continue;
      const d = Math.hypot(x - tx, y - ty);
      if (d > radius) continue;
      const v = level * (1 - d / (radius + 1));
      const i = y * COLS + x;
      w.water[i] = Math.max(w.water[i], Math.min(1, v));
    }
  }
}

export function stageShot(shot, seed = 7) {
  const w = createWorld(seed);
  if (shot === 'start') {
    w.screen = 'title';
    return w;
  }
  if (shot === 'play') {
    w.screen = 'playing';
    w.elapsed = 86;
    w.timeLeft = 94;
    w.score = 450;
    // Two pipes already fixed; the rest still burst with water pooling.
    w.pipes[0].fixed = true;
    w.pipes[3].fixed = true;
    for (const p of w.pipes) {
      if (!p.fixed) paintWaterBlob(w, p.tx, p.ty, 3, 0.95);
    }
    w.coverage = computeCoverage(w);
    w.pressure = Math.min(100, 4 * 11 + w.coverage * 55);
    w.pressureTier = w.pressure < 25 ? 'CALM' : w.pressure < 50 ? 'BUSY' : w.pressure < 75 ? 'RUSH' : 'FLOODING';
    w.wrenchUntil = w.elapsed + 7;
    w.player.x = (19 + 0.5) * TILE;
    w.player.y = (12 + 0.5) * TILE;
    return w;
  }
  // 'end': the win screen.
  w.screen = 'win';
  w.score = 2714;
  w.best = 2714;
  w.timeLeft = 145;
  w.elapsed = 35;
  for (const p of w.pipes) p.fixed = true;
  w.coverage = 0;
  w.pressure = 0;
  w.pressureTier = 'CALM';
  return w;
}
