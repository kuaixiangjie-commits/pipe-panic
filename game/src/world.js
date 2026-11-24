// Pipe Panic! — game state and simulation.
import { CONFIG } from './config.js';
import { createRng, pickRng } from './random.js';
import * as MAP from './map.js';

const { COLS, ROWS, TILE } = CONFIG;

export function createWorld(seed = 1) {
  const rng = createRng(seed);
  return {
    seed,
    rng,
    screen: 'title',
    timeLeft: CONFIG.SHIFT_SECONDS,
    elapsed: 0,
    score: 0,
    best: 0,
    player: { x: MAP.PLAYER_START.x, y: MAP.PLAYER_START.y, dir: 1 },
    pipes: MAP.PIPE_SPOTS.map((s, i) => ({
      id: i,
      tx: s.tx,
      ty: s.ty,
      x: (s.tx + 0.5) * TILE,
      y: (s.ty + 0.5) * TILE,
      fixed: false,
      progress: 0,
    })),
    water: new Float32Array(COLS * ROWS),
    scratch: new Float32Array(COLS * ROWS),
    coverage: 0,
    pressure: 0,
    pressureTier: 'CALM',
    rebursts: 0,
    reburstTimer: 0,
    wrenchUntil: 0,
    coffeeUntil: 0,
    pickups: MAP.PICKUP_SPOTS.map((s) => ({
      kind: s.kind,
      tx: s.tx,
      ty: s.ty,
      x: (s.tx + 0.5) * TILE,
      y: (s.ty + 0.5) * TILE,
      taken: false,
    })),
    ducksGot: 0,
    moppedTiles: 0,
    message: '',
    messageUntil: 0,
    loseReason: '',
  };
}

export function burstCount(w) {
  let n = 0;
  for (const p of w.pipes) if (!p.fixed) n++;
  return n;
}

export function computeCoverage(w) {
  let wet = 0;
  let total = 0;
  for (let ty = 0; ty < ROWS; ty++) {
    for (let tx = 0; tx < COLS; tx++) {
      if (MAP.isWallTile(tx, ty)) continue;
      total++;
      if (w.water[ty * COLS + tx] > CONFIG.WATER_COVER_THRESHOLD) wet++;
    }
  }
  return total === 0 ? 0 : wet / total;
}

function tierOf(pressure) {
  if (pressure < 25) return 'CALM';
  if (pressure < 50) return 'BUSY';
  if (pressure < 75) return 'RUSH';
  return 'FLOODING';
}

function diffuse(w, dt) {
  const k = CONFIG.WATER_DIFFUSE * dt * 0.25;
  const src = w.water;
  const dst = w.scratch;
  dst.set(src);
  for (let ty = 0; ty < ROWS; ty++) {
    for (let tx = 0; tx < COLS; tx++) {
      const i = ty * COLS + tx;
      if (src[i] <= 0 || MAP.isWallTile(tx, ty)) continue;
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const nx = tx + dx;
        const ny = ty + dy;
        if (MAP.isWallTile(nx, ny)) continue;
        const j = ny * COLS + nx;
        const diff = src[i] - src[j];
        if (diff <= 0) continue;
        const t = diff * k;
        dst[i] -= t;
        dst[j] += t;
      }
    }
  }
  for (let i = 0; i < src.length; i++) {
    src[i] = dst[i] < 0 ? 0 : dst[i] > 1 ? 1 : dst[i];
  }
}

function nearestPipe(w, x, y, maxDist) {
  let best = null;
  let bestD = maxDist;
  for (const p of w.pipes) {
    if (p.fixed) continue;
    const d = Math.hypot(p.x - x, p.y - y);
    if (d < bestD) {
      bestD = d;
      best = p;
    }
  }
  return best;
}

export function updateWorld(w, input, dt, sound) {
  if (w.screen !== 'playing') return;
  w.elapsed += dt;
  w.timeLeft -= dt;
  if (w.timeLeft <= 0) {
    w.timeLeft = 0;
    w.screen = 'lose';
    w.loseReason = 'time';
    if (sound) sound.play('lose');
    return;
  }

  // Movement.
  const axis = input.axis();
  if (axis.x !== 0 || axis.y !== 0) {
    const len = Math.hypot(axis.x, axis.y);
    const nx = axis.x / len;
    const ny = axis.y / len;
    const speed = w.elapsed < w.coffeeUntil ? CONFIG.COFFEE_SPEED : CONFIG.PLAYER_SPEED;
    const moved = MAP.moveWithCollision(
      w.player.x,
      w.player.y,
      nx * speed * dt,
      ny * speed * dt,
      CONFIG.PLAYER_RADIUS,
    );
    w.player.x = moved.x;
    w.player.y = moved.y;
    if (axis.x !== 0) w.player.dir = axis.x > 0 ? 1 : -1;
  }

  // Pickups.
  for (const pk of w.pickups) {
    if (pk.taken) continue;
    if (Math.hypot(pk.x - w.player.x, pk.y - w.player.y) < 28) {
      pk.taken = true;
      if (pk.kind === 'wrench') {
        w.wrenchUntil = w.elapsed + CONFIG.WRENCH_SECONDS;
        w.message = 'Wrench! Repairs twice as fast';
        if (sound) sound.play('pickup');
      } else if (pk.kind === 'coffee') {
        w.coffeeUntil = w.elapsed + CONFIG.COFFEE_SECONDS;
        w.message = 'Coffee! Moving faster';
        if (sound) sound.play('pickup');
      } else {
        w.ducksGot++;
        w.score += CONFIG.SCORE_DUCK;
        w.message = 'Rubber duck! +50';
        if (sound) sound.play('duck');
      }
      w.messageUntil = w.elapsed + 2.5;
    }
  }

  // Hold E: repair a nearby burst pipe, otherwise mop water.
  if (input.action()) {
    const pipe = nearestPipe(w, w.player.x, w.player.y, CONFIG.REPAIR_RADIUS);
    if (pipe) {
      const rate = CONFIG.REPAIR_RATE * (w.elapsed < w.wrenchUntil ? 2 : 1);
      pipe.progress += rate * dt;
      if (pipe.progress >= 1) {
        pipe.fixed = true;
        pipe.progress = 1;
        w.score += CONFIG.SCORE_REPAIR;
        w.message = 'Pipe fixed! +150';
        w.messageUntil = w.elapsed + 2;
        if (sound) sound.play('fix');
      } else if (sound) {
        sound.play('tick');
      }
    } else {
      // Mop water around the player.
      const r = CONFIG.MOP_RADIUS;
      const x0 = Math.max(0, Math.floor((w.player.x - r) / TILE));
      const x1 = Math.min(COLS - 1, Math.floor((w.player.x + r) / TILE));
      const y0 = Math.max(0, Math.floor((w.player.y - r) / TILE));
      const y1 = Math.min(ROWS - 1, Math.floor((w.player.y + r) / TILE));
      for (let ty = y0; ty <= y1; ty++) {
        for (let tx = x0; tx <= x1; tx++) {
          const cx = (tx + 0.5) * TILE;
          const cy = (ty + 0.5) * TILE;
          if (Math.hypot(cx - w.player.x, cy - w.player.y) > r) continue;
          const i = ty * COLS + tx;
          const before = w.water[i];
          if (before <= 0) continue;
          const after = Math.max(0, before - CONFIG.MOP_RATE * dt);
          w.water[i] = after;
          if (before > CONFIG.WATER_COVER_THRESHOLD && after <= CONFIG.WATER_COVER_THRESHOLD) {
            w.moppedTiles++;
            w.score += CONFIG.SCORE_MOP_TILE;
          }
        }
      }
    }
  }

  // Water: burst pipes inject, then it diffuses.
  for (const p of w.pipes) {
    if (p.fixed) continue;
    const i = p.ty * COLS + p.tx;
    w.water[i] = Math.min(1, w.water[i] + CONFIG.WATER_INJECT * dt);
  }
  diffuse(w, dt);
  w.coverage = computeCoverage(w);

  // Pressure follows burst pipes and standing water.
  const burst = burstCount(w);
  w.pressure = Math.min(100, burst * 11 + w.coverage * 55);
  w.pressureTier = tierOf(w.pressure);

  // At high pressure, a fixed pipe can burst again (at most twice a game).
  if (w.pressure >= CONFIG.REBURST_PRESSURE) {
    w.reburstTimer += dt;
    if (w.reburstTimer >= CONFIG.REBURST_DELAY && w.rebursts < CONFIG.REBURST_MAX) {
      const fixed = w.pipes.filter((p) => p.fixed);
      if (fixed.length > 0) {
        const p = pickRng(w.rng, fixed);
        p.fixed = false;
        p.progress = 0;
        w.rebursts++;
        w.reburstTimer = 0;
        w.message = 'A pipe burst again!';
        w.messageUntil = w.elapsed + 2.5;
        if (sound) sound.play('alarm');
      }
    }
  } else {
    w.reburstTimer = 0;
  }

  if (w.coverage >= CONFIG.FLOOD_COVERAGE) {
    w.screen = 'lose';
    w.loseReason = 'flood';
    if (sound) sound.play('lose');
    return;
  }

  if (burstCount(w) === 0) {
    w.screen = 'win';
    w.score += Math.round(w.timeLeft) * CONFIG.SCORE_TIME_BONUS;
    if (w.score > w.best) {
      w.best = w.score;
      try {
        localStorage.setItem('pipe-panic-best', String(w.best));
      } catch (e) {
        // storage unavailable; best score just isn't saved
      }
    }
    if (sound) sound.play('win');
  }
}
