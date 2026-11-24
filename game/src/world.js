// Pipe Panic! game state: movement + collision, water simulation, pressure,
// repair / mop, pickups, re-bursts, and the win / lose rules.
import {
  COLS,
  ROWS,
  TILE,
  SHIFT_SECONDS,
  FLOOD_COVERAGE,
  PLAYER_R,
  PLAYER_SPEED,
  COFFEE_SPEED,
  REPAIR_RANGE,
  REPAIR_RATE,
  WRENCH_RATE,
  MOP_RADIUS,
  MOP_RATE,
  PICKUP_DURATION,
  PICKUP_RADIUS,
  POINTS_REPAIR,
  POINTS_DUCK,
  POINTS_MOP_TILE,
  TIME_BONUS_PER_SECOND,
  PRESSURE_FIX_DROP,
  WATER_INJECT,
  WATER_DIFFUSE,
  WATER_MOP_THRESHOLD,
  PRESSURE_PER_LEAK,
  PRESSURE_PER_COVERAGE,
  PRESSURE_IDLE_DRAIN,
  REBURST_AT,
  REBURST_INTERVAL,
  MAX_REBURSTS,
  tierName,
} from "./config.js";
import { buildGrid, PIPES, PICKUPS, PLAYER_START, tileCenter } from "./map.js";
import { mulberry32 } from "./random.js";

function countFloor(grid) {
  let n = 0;
  for (const row of grid) for (const v of row) if (v === 0) n++;
  return n;
}

function loadBest() {
  try {
    return Number(localStorage.getItem("pipe-panic-best") || 0) || 0;
  } catch {
    return 0;
  }
}

export class World {
  constructor(seed) {
    this.seed = seed >>> 0 || 1;
    this.rng = mulberry32(this.seed);
    this.grid = buildGrid();
    this.floorTiles = countFloor(this.grid);
    this.water = new Float32Array(COLS * ROWS);
    this.waterNext = new Float32Array(COLS * ROWS);
    this.pipes = PIPES.map((p) => {
      const c = tileCenter(p.tx, p.ty);
      return { tx: p.tx, ty: p.ty, x: c.x, y: c.y, room: p.room, burst: true, progress: 0 };
    });
    this.pickups = PICKUPS.map((p) => {
      const c = tileCenter(p.tx, p.ty);
      return { tx: p.tx, ty: p.ty, x: c.x, y: c.y, kind: p.kind, taken: false };
    });
    const s = tileCenter(PLAYER_START.tx, PLAYER_START.ty);
    this.player = { x: s.x, y: s.y, r: PLAYER_R };
    this.effects = { wrench: 0, coffee: 0 };
    this.score = 0;
    this.ducks = 0;
    this.timeLeft = SHIFT_SECONDS;
    this.pressure = 0;
    this.coverage = 0;
    this.screen = "title";
    this.result = null; // 'win' | 'flood' | 'time'
    this.timeBonus = 0;
    this.reburstTimer = 0;
    this.reburstCount = 0;
    this.mopCredit = 0;
    this.repairSoundAt = 0;
    this.best = loadBest();
    // Sound hooks, wired by main.js (optional).
    this.onPickup = null;
    this.onRepairTick = null;
    this.onFixed = null;
    this.onReburst = null;
    this.onWin = null;
    this.onLose = null;
  }

  start() {
    this.screen = "playing";
  }

  solidAt(tx, ty) {
    if (tx < 0 || ty < 0 || tx >= COLS || ty >= ROWS) return true;
    return this.grid[ty][tx] !== 0;
  }

  // Circle-vs-tile collision test for a position.
  collides(x, y, r) {
    const x0 = Math.floor((x - r) / TILE);
    const x1 = Math.floor((x + r) / TILE);
    const y0 = Math.floor((y - r) / TILE);
    const y1 = Math.floor((y + r) / TILE);
    for (let ty = y0; ty <= y1; ty++) {
      for (let tx = x0; tx <= x1; tx++) {
        if (!this.solidAt(tx, ty)) continue;
        const cx = Math.max(tx * TILE, Math.min(x, tx * TILE + TILE));
        const cy = Math.max(ty * TILE, Math.min(y, ty * TILE + TILE));
        const dx = x - cx;
        const dy = y - cy;
        if (dx * dx + dy * dy < r * r) return true;
      }
    }
    return false;
  }

  // Move along one axis; when blocked, retry with small perpendicular nudges
  // so the plumber slides around door-frame corners instead of wedging on them.
  moveAxis(dx, dy) {
    const p = this.player;
    if (dx !== 0) {
      if (!this.collides(p.x + dx, p.y, p.r)) {
        p.x += dx;
        return;
      }
      for (const n of [3, 6, 9, 12]) {
        if (!this.collides(p.x + dx, p.y + n, p.r)) {
          p.x += dx;
          p.y += n;
          return;
        }
        if (!this.collides(p.x + dx, p.y - n, p.r)) {
          p.x += dx;
          p.y -= n;
          return;
        }
      }
    } else if (dy !== 0) {
      if (!this.collides(p.x, p.y + dy, p.r)) {
        p.y += dy;
        return;
      }
      for (const n of [3, 6, 9, 12]) {
        if (!this.collides(p.x + n, p.y + dy, p.r)) {
          p.x += n;
          p.y += dy;
          return;
        }
        if (!this.collides(p.x - n, p.y + dy, p.r)) {
          p.x -= n;
          p.y += dy;
          return;
        }
      }
    }
  }

  nearestBurstPipe() {
    let best = null;
    let bestD = REPAIR_RANGE * REPAIR_RANGE;
    for (const p of this.pipes) {
      if (!p.burst) continue;
      const dx = p.x - this.player.x;
      const dy = p.y - this.player.y;
      const d = dx * dx + dy * dy;
      if (d < bestD) {
        bestD = d;
        best = p;
      }
    }
    return best;
  }

  mop(dt) {
    const p = this.player;
    const r = MOP_RADIUS;
    const x0 = Math.max(0, Math.floor((p.x - r) / TILE));
    const x1 = Math.min(COLS - 1, Math.floor((p.x + r) / TILE));
    const y0 = Math.max(0, Math.floor((p.y - r) / TILE));
    const y1 = Math.min(ROWS - 1, Math.floor((p.y + r) / TILE));
    let removed = 0;
    for (let ty = y0; ty <= y1; ty++) {
      for (let tx = x0; tx <= x1; tx++) {
        if (this.grid[ty][tx] !== 0) continue;
        const cx = tx * TILE + TILE / 2;
        const cy = ty * TILE + TILE / 2;
        const dx = cx - p.x;
        const dy = cy - p.y;
        if (dx * dx + dy * dy > r * r) continue;
        const i = ty * COLS + tx;
        const take = Math.min(this.water[i], MOP_RATE * dt);
        if (take > 0) {
          this.water[i] -= take;
          removed += take;
        }
      }
    }
    if (removed > 0) {
      this.mopCredit += removed * POINTS_MOP_TILE;
      const whole = Math.floor(this.mopCredit);
      if (whole > 0) {
        this.score += whole;
        this.mopCredit -= whole;
      }
      this.pressure = Math.max(0, this.pressure - removed * 0.4);
    }
  }

  simulateWater(dt) {
    const { water, waterNext } = this;
    for (const p of this.pipes) {
      if (!p.burst) continue;
      const i = p.ty * COLS + p.tx;
      water[i] = Math.min(1, water[i] + WATER_INJECT * dt);
    }
    waterNext.set(water);
    const k = WATER_DIFFUSE * dt;
    for (let ty = 0; ty < ROWS; ty++) {
      for (let tx = 0; tx < COLS; tx++) {
        const i = ty * COLS + tx;
        const w = water[i];
        if (w <= 0.01) continue;
        if (this.grid[ty][tx] !== 0) continue;
        const dirs = [
          [1, 0],
          [-1, 0],
          [0, 1],
          [0, -1],
        ];
        for (const [dx, dy] of dirs) {
          const nx = tx + dx;
          const ny = ty + dy;
          if (nx < 0 || ny < 0 || nx >= COLS || ny >= ROWS) continue;
          if (this.grid[ny][nx] !== 0) continue;
          const j = ny * COLS + nx;
          const flow = Math.min(w * k * 0.25, Math.max(0, (w - water[j]) * 0.25));
          if (flow > 0) {
            waterNext[i] -= flow;
            waterNext[j] += flow;
          }
        }
      }
    }
    for (let i = 0; i < water.length; i++) {
      water[i] = Math.max(0, Math.min(1, waterNext[i]));
    }
    let wet = 0;
    for (let ty = 0; ty < ROWS; ty++) {
      for (let tx = 0; tx < COLS; tx++) {
        if (this.grid[ty][tx] === 0 && water[ty * COLS + tx] > WATER_MOP_THRESHOLD) wet++;
      }
    }
    this.coverage = this.floorTiles === 0 ? 0 : wet / this.floorTiles;
  }

  update(dt, input) {
    if (this.screen !== "playing") return;
    this.timeLeft -= dt;
    if (this.timeLeft <= 0) {
      this.timeLeft = 0;
      this.lose("time");
      return;
    }
    if (this.effects.wrench > 0) this.effects.wrench = Math.max(0, this.effects.wrench - dt);
    if (this.effects.coffee > 0) this.effects.coffee = Math.max(0, this.effects.coffee - dt);

    const dir = input.dir();
    const speed = this.effects.coffee > 0 ? COFFEE_SPEED : PLAYER_SPEED;
    if (dir.x !== 0 || dir.y !== 0) {
      this.moveAxis(dir.x * speed * dt, 0);
      this.moveAxis(0, dir.y * speed * dt);
    }

    for (const pk of this.pickups) {
      if (pk.taken) continue;
      const dx = this.player.x - pk.x;
      const dy = this.player.y - pk.y;
      if (dx * dx + dy * dy < PICKUP_RADIUS * PICKUP_RADIUS) {
        pk.taken = true;
        if (pk.kind === "wrench") this.effects.wrench = PICKUP_DURATION;
        else if (pk.kind === "coffee") this.effects.coffee = PICKUP_DURATION;
        else if (pk.kind === "duck") {
          this.ducks++;
          this.score += POINTS_DUCK;
        }
        if (this.onPickup) this.onPickup(pk.kind);
      }
    }

    if (input.isDown("KeyE")) {
      const pipe = this.nearestBurstPipe();
      if (pipe) {
        const rate = this.effects.wrench > 0 ? WRENCH_RATE : REPAIR_RATE;
        pipe.progress += rate * dt;
        this.repairSoundAt += dt;
        if (this.repairSoundAt > 0.22) {
          this.repairSoundAt = 0;
          if (this.onRepairTick) this.onRepairTick();
        }
        if (pipe.progress >= 1) {
          pipe.burst = false;
          pipe.progress = 1;
          this.score += POINTS_REPAIR;
          this.pressure = Math.max(0, this.pressure - PRESSURE_FIX_DROP);
          if (this.onFixed) this.onFixed(pipe);
          if (this.pipes.every((q) => !q.burst)) {
            this.win();
            return;
          }
        }
      } else {
        this.mop(dt);
      }
    }

    this.simulateWater(dt);

    const burstCount = this.pipes.filter((p) => p.burst).length;
    this.pressure += (burstCount * PRESSURE_PER_LEAK + this.coverage * PRESSURE_PER_COVERAGE) * dt;
    if (burstCount === 0) this.pressure -= PRESSURE_IDLE_DRAIN * dt;
    this.pressure = Math.max(0, Math.min(100, this.pressure));

    if (this.pressure >= REBURST_AT && this.reburstCount < MAX_REBURSTS) {
      this.reburstTimer += dt;
      if (this.reburstTimer >= REBURST_INTERVAL) {
        this.reburstTimer = 0;
        const fixed = this.pipes.filter((p) => !p.burst);
        if (fixed.length > 0) {
          const p = fixed[Math.floor(this.rng() * fixed.length)];
          p.burst = true;
          p.progress = 0;
          this.reburstCount++;
          if (this.onReburst) this.onReburst(p);
        }
      }
    } else {
      this.reburstTimer = 0;
    }

    if (this.coverage >= FLOOD_COVERAGE) this.lose("flood");
  }

  win() {
    this.screen = "win";
    this.result = "win";
    this.timeBonus = Math.ceil(this.timeLeft) * TIME_BONUS_PER_SECOND;
    this.score += this.timeBonus;
    this.saveBest();
    if (this.onWin) this.onWin();
  }

  lose(reason) {
    this.screen = "lose";
    this.result = reason;
    this.saveBest();
    if (this.onLose) this.onLose(reason);
  }

  saveBest() {
    if (this.score > this.best) {
      this.best = this.score;
      try {
        localStorage.setItem("pipe-panic-best", String(this.best));
      } catch {
        // Storage unavailable (private mode, etc.) — best score just isn't kept.
      }
    }
  }

  snapshot() {
    return {
      screen: this.screen,
      result: this.result,
      score: this.score,
      best: this.best,
      timeLeft: Math.round(this.timeLeft * 10) / 10,
      pipesFixed: this.pipes.filter((p) => !p.burst).length,
      pipes: this.pipes.map((p) => ({
        x: p.x,
        y: p.y,
        burst: p.burst,
        progress: Math.round(p.progress * 100) / 100,
      })),
      player: { x: Math.round(this.player.x), y: Math.round(this.player.y) },
      pressure: Math.round(this.pressure),
      tier: tierName(this.pressure),
      coverage: Math.round(this.coverage * 1000) / 1000,
      ducks: this.ducks,
      effects: {
        wrench: Math.round(this.effects.wrench * 10) / 10,
        coffee: Math.round(this.effects.coffee * 10) / 10,
      },
      tile: TILE,
      grid: this.grid,
    };
  }
}
