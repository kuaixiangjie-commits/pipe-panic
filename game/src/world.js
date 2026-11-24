// Pipe Panic! — the game world: player, pipes, water, pressure, pickups,
// scoring, and the win / lose rules. All coordinates are map coordinates
// (0..1600, 0..1200); the renderer adds the HUD offset when drawing.
import {
  BEST_KEY,
  COFFEE_SPEED,
  COLS,
  FLOOD_COVERAGE,
  MOP_RADIUS,
  MOP_RATE,
  PICKUP_DURATION,
  PIPE_COUNT,
  PLAYER_R,
  PLAYER_SPEED,
  POINTS_DUCK,
  POINTS_MOP_PER_UNIT,
  POINTS_REPAIR,
  POINTS_TIME_BONUS,
  PRESSURE_BUSY,
  PRESSURE_CALM,
  PRESSURE_RUSH,
  REBURST_CHANCE,
  REBURST_MIN_GAP,
  REPAIR_RANGE,
  REPAIR_RATE,
  ROWS,
  SHIFT_SECONDS,
  TILE,
  WATER_COVER_THRESHOLD,
  WATER_DIFFUSE,
  WATER_INJECT,
  WRENCH_RATE,
} from "./config.js";
import { PIPES, PICKUPS, PLAYER_START, buildGrid, tileCenter } from "./map.js";

export class World {
  constructor() {
    this.grid = buildGrid();
    this.floor = new Uint8Array(COLS * ROWS);
    this.floorTiles = 0;
    for (let ty = 0; ty < ROWS; ty++) {
      for (let tx = 0; tx < COLS; tx++) {
        if (this.grid[ty][tx] === 0) {
          this.floor[ty * COLS + tx] = 1;
          this.floorTiles++;
        }
      }
    }
    this.water = new Float32Array(COLS * ROWS);
    this.scratch = new Float32Array(COLS * ROWS);
    this.best = 0;
    try {
      this.best = Number(localStorage.getItem(BEST_KEY)) || 0;
    } catch {
      this.best = 0;
    }
    this.time = 0; // render clock, always advances (drives animations)
    this.frozen = false; // staged ?shot= scenes freeze the simulation
    this.reset();
    this.screen = "title";
  }

  // Fresh state. The caller sets `screen` afterwards.
  reset() {
    this.timeLeft = SHIFT_SECONDS;
    this.score = 0;
    this.timeBonus = 0;
    this.mopAcc = 0;
    this.pressure = 0;
    this.pressureTier = "CALM";
    this.reason = "";
    this.won = false;
    this.lost = false;
    this.elapsed = 0;
    this.water.fill(0);
    this.pipes = PIPES.map((p) => {
      const c = tileCenter(p.tx, p.ty);
      return {
        id: p.id,
        tx: p.tx,
        ty: p.ty,
        room: p.room,
        x: c.x,
        y: c.y,
        burst: true,
        progress: 0,
      };
    });
    this.pickups = PICKUPS.map((p) => {
      const c = tileCenter(p.tx, p.ty);
      return { kind: p.kind, tx: p.tx, ty: p.ty, x: c.x, y: c.y, taken: false };
    });
    const s = tileCenter(PLAYER_START.tx, PLAYER_START.ty);
    this.player = { x: s.x, y: s.y, r: PLAYER_R, face: 1, moving: false };
    this.wrenchTime = 0;
    this.coffeeTime = 0;
    this.lastReburst = 0;
    this.repairTarget = null;
    this.mopping = false;
    this.repairFx = 0;
    this.mopFx = 0;
    this.alarmAt = 0;
    this.frozen = false;
  }

  start() {
    this.reset();
    this.screen = "playing";
  }

  get pipesFixed() {
    let n = 0;
    for (const p of this.pipes) if (!p.burst) n++;
    return n;
  }

  coverage() {
    let wet = 0;
    for (let i = 0; i < this.water.length; i++) {
      if (this.floor[i] && this.water[i] >= WATER_COVER_THRESHOLD) wet++;
    }
    return this.floorTiles === 0 ? 0 : wet / this.floorTiles;
  }

  tierFor(pressure) {
    if (pressure < PRESSURE_CALM) return "CALM";
    if (pressure < PRESSURE_BUSY) return "BUSY";
    if (pressure < PRESSURE_RUSH) return "RUSH";
    return "FLOODING";
  }

  // Set pressure from the current state at once (used to stage scenes).
  settlePressure() {
    const burst = this.pipes.filter((p) => p.burst).length;
    this.pressure = 15 + 55 * this.coverage() + 6 * burst;
    this.pressureTier = this.tierFor(this.pressure);
  }

  nearestBurstPipe(range) {
    let bestPipe = null;
    let bestD = Infinity;
    for (const p of this.pipes) {
      if (!p.burst) continue;
      const d = Math.hypot(p.x - this.player.x, p.y - this.player.y);
      if (d < bestD) {
        bestD = d;
        bestPipe = p;
      }
    }
    return bestD <= range ? bestPipe : null;
  }

  hitsSolid(x, y, r) {
    const x0 = Math.max(0, Math.floor((x - r) / TILE));
    const x1 = Math.min(COLS - 1, Math.floor((x + r) / TILE));
    const y0 = Math.max(0, Math.floor((y - r) / TILE));
    const y1 = Math.min(ROWS - 1, Math.floor((y + r) / TILE));
    for (let ty = y0; ty <= y1; ty++) {
      for (let tx = x0; tx <= x1; tx++) {
        if (this.grid[ty][tx] === 0) continue;
        const cx = Math.max(tx * TILE, Math.min(x, tx * TILE + TILE));
        const cy = Math.max(ty * TILE, Math.min(y, ty * TILE + TILE));
        const dx = x - cx;
        const dy = y - cy;
        if (dx * dx + dy * dy < r * r) return true;
      }
    }
    return false;
  }

  moveAxis(p, dx, dy) {
    const nx = p.x + dx;
    const ny = p.y + dy;
    if (!this.hitsSolid(nx, ny, p.r)) {
      p.x = nx;
      p.y = ny;
      return;
    }
    // Corner assist: the direct step is blocked (a wall corner or a door
    // frame). Try the same step with a small sideways nudge so the plumber
    // slides into a doorway instead of wedging on a corner. The nudge only
    // applies when the nudged spot is clear, so it can never push the
    // plumber through a gap too narrow to fit.
    const steps = [3, 6, 9, 12];
    for (const s of steps) {
      for (const sign of [1, -1]) {
        const ox = dx !== 0 ? 0 : s * sign;
        const oy = dy !== 0 ? 0 : s * sign;
        if (!this.hitsSolid(p.x + dx + ox, p.y + dy + oy, p.r)) {
          p.x = p.x + dx + ox;
          p.y = p.y + dy + oy;
          return;
        }
      }
    }
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
        const cx = tx * TILE + TILE / 2;
        const cy = ty * TILE + TILE / 2;
        if (Math.hypot(cx - p.x, cy - p.y) > r) continue;
        const i = ty * COLS + tx;
        const take = Math.min(this.water[i], MOP_RATE * dt);
        this.water[i] -= take;
        removed += take;
      }
    }
    return removed;
  }

  updateWater(dt) {
    const w = this.water;
    const s = this.scratch;
    for (const p of this.pipes) {
      if (!p.burst) continue;
      const i = p.ty * COLS + p.tx;
      w[i] = Math.min(1, w[i] + WATER_INJECT * dt);
    }
    const k = Math.min(1, WATER_DIFFUSE * dt);
    for (let ty = 0; ty < ROWS; ty++) {
      for (let tx = 0; tx < COLS; tx++) {
        const i = ty * COLS + tx;
        if (this.grid[ty][tx] !== 0) {
          s[i] = 0;
          continue;
        }
        let sum = w[i];
        let n = 1;
        if (tx > 0 && this.grid[ty][tx - 1] === 0) {
          sum += w[i - 1];
          n++;
        }
        if (tx < COLS - 1 && this.grid[ty][tx + 1] === 0) {
          sum += w[i + 1];
          n++;
        }
        if (ty > 0 && this.grid[ty - 1][tx] === 0) {
          sum += w[i - COLS];
          n++;
        }
        if (ty < ROWS - 1 && this.grid[ty + 1][tx] === 0) {
          sum += w[i + COLS];
          n++;
        }
        s[i] = w[i] + (sum / n - w[i]) * k;
      }
    }
    this.water.set(s);
  }

  win() {
    this.screen = "win";
    this.won = true;
    this.timeBonus = Math.ceil(this.timeLeft) * POINTS_TIME_BONUS;
    this.score += this.timeBonus;
    this.saveBest();
  }

  lose(reason) {
    this.screen = "lose";
    this.lost = true;
    this.reason = reason;
    this.timeBonus = 0;
    this.saveBest();
  }

  saveBest() {
    if (this.score > this.best) {
      this.best = this.score;
      try {
        localStorage.setItem(BEST_KEY, String(this.best));
      } catch {
        // Storage may be unavailable; the best score is a nicety.
      }
    }
  }

  update(dt, input, sound) {
    this.time += dt;
    this.repairFx = Math.max(0, this.repairFx - dt);
    this.mopFx = Math.max(0, this.mopFx - dt);
    if (this.screen !== "playing" || this.frozen) return;

    this.elapsed += dt;
    this.timeLeft -= dt;
    if (this.timeLeft <= 0) {
      this.timeLeft = 0;
      this.lose("time");
      sound.lose();
      return;
    }
    if (this.wrenchTime > 0) this.wrenchTime -= dt;
    if (this.coffeeTime > 0) this.coffeeTime -= dt;

    // Movement (axis-separated so the plumber slides along walls).
    let dx = 0;
    let dy = 0;
    if (input.isDown("KeyA", "ArrowLeft")) dx -= 1;
    if (input.isDown("KeyD", "ArrowRight")) dx += 1;
    if (input.isDown("KeyW", "ArrowUp")) dy -= 1;
    if (input.isDown("KeyS", "ArrowDown")) dy += 1;
    const len = Math.hypot(dx, dy) || 1;
    dx /= len;
    dy /= len;
    const speed = this.coffeeTime > 0 ? COFFEE_SPEED : PLAYER_SPEED;
    const p = this.player;
    p.moving = dx !== 0 || dy !== 0;
    if (dx !== 0) p.face = dx > 0 ? 1 : -1;
    this.moveAxis(p, dx * speed * dt, 0);
    this.moveAxis(p, 0, dy * speed * dt);

    // Hold E: repair a burst pipe nearby, or mop up water.
    const eHeld = input.isDown("KeyE");
    this.repairTarget = null;
    this.mopping = false;
    if (eHeld) {
      const pipe = this.nearestBurstPipe(REPAIR_RANGE);
      if (pipe) {
        this.repairTarget = pipe;
        const rate = this.wrenchTime > 0 ? WRENCH_RATE : REPAIR_RATE;
        pipe.progress += rate * dt;
        this.repairFx = 0.15;
        sound.tick();
        if (pipe.progress >= 1) {
          pipe.burst = false;
          pipe.progress = 0;
          this.score += POINTS_REPAIR;
          sound.fixed();
          if (this.pipesFixed === PIPE_COUNT) {
            this.win();
            sound.win();
            return;
          }
        }
      } else {
        this.mopping = true;
        this.mopFx = 0.15;
        const removed = this.mop(dt);
        if (removed > 0) {
          this.mopAcc += removed * POINTS_MOP_PER_UNIT;
          if (this.mopAcc >= 1) {
            const add = Math.floor(this.mopAcc);
            this.score += add;
            this.mopAcc -= add;
          }
        }
      }
    }

    // Pickups.
    for (const pk of this.pickups) {
      if (pk.taken) continue;
      const d = Math.hypot(pk.x - p.x, pk.y - p.y);
      if (d < 30) {
        pk.taken = true;
        if (pk.kind === "wrench") {
          this.wrenchTime = PICKUP_DURATION;
          sound.pickup();
        } else if (pk.kind === "coffee") {
          this.coffeeTime = PICKUP_DURATION;
          sound.pickup();
        } else if (pk.kind === "duck") {
          this.score += POINTS_DUCK;
          sound.quack();
        }
      }
    }

    // Water spreads from every burst pipe.
    this.updateWater(dt);
    const cov = this.coverage();
    if (cov >= FLOOD_COVERAGE) {
      this.lose("flood");
      sound.lose();
      return;
    }

    // Pressure follows the water and the burst pipes.
    const burstCount = this.pipes.filter((q) => q.burst).length;
    const target = 15 + 55 * cov + 6 * burstCount;
    this.pressure += (target - this.pressure) * Math.min(1, 0.4 * dt);
    this.pressureTier = this.tierFor(this.pressure);
    if (this.pressureTier === "FLOODING" && this.time - this.alarmAt > 2.5) {
      this.alarmAt = this.time;
      sound.alarm();
    }

    // At high pressure a repaired pipe can burst again mid-shift.
    if (this.pressure >= PRESSURE_RUSH && this.elapsed - this.lastReburst > REBURST_MIN_GAP) {
      const fixed = this.pipes.filter((q) => !q.burst);
      if (fixed.length > 0 && Math.random() < REBURST_CHANCE * dt) {
        const pick = fixed[Math.floor(Math.random() * fixed.length)];
        pick.burst = true;
        pick.progress = 0;
        this.lastReburst = this.elapsed;
      }
    }
  }

  // Plain snapshot for the autopilot / debugging (no methods, no cycles).
  snapshot() {
    return {
      screen: this.screen,
      timeLeft: Math.ceil(this.timeLeft),
      score: this.score,
      best: this.best,
      pipesFixed: this.pipesFixed,
      pipes: this.pipes.map((p) => ({
        x: p.x,
        y: p.y,
        tx: p.tx,
        ty: p.ty,
        burst: p.burst,
        progress: p.progress,
      })),
      player: { x: this.player.x, y: this.player.y },
      coverage: this.coverage(),
      pressure: this.pressure,
      tier: this.pressureTier,
      reason: this.reason,
      wrenchTime: Math.max(0, this.wrenchTime),
      coffeeTime: Math.max(0, this.coffeeTime),
    };
  }
}
