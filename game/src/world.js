// Pipe Panic! — the game's rules and state, with no drawing and no browser
// in it: the plumber, the burst pipes, the spreading water, the pickups, the
// pressure gauge, the score and the clock. step() advances one fixed step and
// returns what happened as bit flags, so the caller can react (and play a
// sound) without the world knowing about screens or sound. Nothing here
// allocates after createWorld returns, except the short-lived particle list.

import {
  CELL, GRID_COLS, GRID_ROWS, PIPE, PLAYER, PRESSURE, PICKUP, SCORE,
  SHIFT_SECONDS, WATER,
} from './config.js';
import { PIPE_RUNS, SPAWN, buildMap, cellOf, circleBlocked, isBlockedCell, pipePointIsOpen } from './map.js';

export const EVENT_FIX = 1;
export const EVENT_PICKUP = 2;
export const EVENT_WIN = 4;
export const EVENT_OVER = 8;
export const EVENT_ALARM = 16;
export const EVENT_BURST = 32;
export const EVENT_MOP = 64;

const DIRS = [[1, 0], [-1, 0], [0, 1], [0, -1]];

/** Fixed pickup spots: kept clear of every wall and piece of furniture. */
const PICKUP_SPOTS = [
  { x: 400, y: 150, kind: 'wrench' },
  { x: 1400, y: 600, kind: 'coffee' },
  { x: 1250, y: 250, kind: 'duck' },
  { x: 300, y: 1000, kind: 'duck' },
  { x: 1450, y: 900, kind: 'duck' },
];

function distance(ax, ay, bx, by) {
  const dx = ax - bx;
  const dy = ay - by;
  return Math.sqrt(dx * dx + dy * dy);
}

export function pressureTier(pressure) {
  let tier = 0;
  for (let i = 0; i < PRESSURE.tiers.length; i += 1) {
    if (pressure >= PRESSURE.tiers[i].at) tier = i;
  }
  return tier;
}

export function createWorld(random) {
  const map = buildMap();
  const water = new Uint8Array(GRID_COLS * GRID_ROWS);
  const wetList = [];
  const particles = [];
  const player = {
    x: SPAWN.x, y: SPAWN.y, facing: -Math.PI / 2, moving: false,
    wrenchT: 0, coffeeT: 0, mopProgress: 0,
  };
  const state = {
    map, water, wetList, particles, player,
    pipes: [], spares: [], pickups: [],
    score: 0, fixedCount: 0, burstCount: 0,
    timeLeft: SHIFT_SECONDS, flood: 0, pressure: 0, tier: 0,
    elapsed: 0, drainTimer: WATER.drainInterval, extraBurstTimer: PIPE.extraBurstInterval,
    won: false, over: false, overReason: '',
  };

  function wetCell(index) {
    if (water[index] === 0) {
      water[index] = 1;
      state.wetCells += 1;
      wetList.push(index);
    } else if (water[index] === 1) {
      water[index] = 2;
    }
  }

  function dryCell(index) {
    if (water[index] === 0) return;
    water[index] -= 1;
    if (water[index] === 0) {
      state.wetCells -= 1;
      const at = wetList.indexOf(index);
      if (at !== -1) wetList.splice(at, 1);
    }
  }

  function cellIndex(col, row) {
    return row * GRID_COLS + col;
  }

  function isFloorCell(col, row) {
    if (col < 0 || col >= GRID_COLS || row < 0 || row >= GRID_ROWS) return false;
    return map.blocked[cellIndex(col, row)] === 0;
  }

  function dryNeighbourOf(col, row) {
    // Fisher-Yates with the seeded stream: a fixed number of draws, so the
  // same seed gives the same shift in every engine (Array.sort with a random
  // comparator calls it an engine-dependent number of times).
  const order = [0, 1, 2, 3];
  for (let i = order.length - 1; i > 0; i -= 1) {
    const j = Math.floor(random() * (i + 1));
    const tmp = order[i];
    order[i] = order[j];
    order[j] = tmp;
  }
    for (let i = 0; i < order.length; i += 1) {
      const nextCol = col + DIRS[order[i]][0];
      const nextRow = row + DIRS[order[i]][1];
      if (!isFloorCell(nextCol, nextRow)) continue;
      const index = cellIndex(nextCol, nextRow);
      if (water[index] === 0) return index;
    }
    return -1;
  }

  function seedPuddle(pipe) {
    const c = cellOf(pipe.x, pipe.y);
    for (let i = 0; i < 2; i += 1) {
      const index = dryNeighbourOf(c.col, c.row);
      if (index !== -1) wetCell(index);
    }
  }

  function spreadWater() {
    let index = -1;
    if (wetList.length === 0) {
      const open = state.pipes.filter((p) => !p.fixed);
      if (open.length === 0) return;
      const pipe = open[Math.floor(random() * open.length)];
      const c = cellOf(pipe.x, pipe.y);
      index = dryNeighbourOf(c.col, c.row);
    } else {
      const from = wetList[Math.floor(random() * wetList.length)];
      const col = from % GRID_COLS;
      const row = Math.floor(from / GRID_COLS);
      index = dryNeighbourOf(col, row);
      if (index === -1 && water[from] === 1) water[from] = 2;
    }
    if (index !== -1) wetCell(index);
  }

  function burstPoints() {
    const points = [];
    for (let r = 0; r < PIPE_RUNS.length; r += 1) {
      const run = PIPE_RUNS[r];
      const length = Math.hypot(run.x2 - run.x1, run.y2 - run.y1);
      const steps = Math.max(1, Math.floor(length / 90));
      for (let i = 0; i < steps; i += 1) {
        const t = (i + 0.5) / steps;
        const x = run.x1 + (run.x2 - run.x1) * t;
        const y = run.y1 + (run.y2 - run.y1) * t;
        // The point's own cell must be floor (runs cross walls, but a burst
        // inside a wall could never be reached), and the floor beside it must
        // be open enough to stand on while repairing.
        const c = cellOf(x, y);
        if (isBlockedCell(map.blocked, c.col, c.row)) continue;
        if (pipePointIsOpen(map.blocked, x, y)) points.push({ x, y });
      }
    }
    for (let i = points.length - 1; i > 0; i -= 1) {
      const j = Math.floor(random() * (i + 1));
      const tmp = points[i];
      points[i] = points[j];
      points[j] = tmp;
    }
    return points;
  }

  function burstPipe(point) {
    return {
      x: point.x, y: point.y, health: 0, fixed: false,
      leakTimer: WATER.spreadInterval * (0.5 + random()),
      spraySeed: random() * Math.PI * 2,
    };
  }

  function spawnParticles(x, y, color, count, speed) {
    for (let i = 0; i < count && particles.length < 120; i += 1) {
      const angle = random() * Math.PI * 2;
      const velocity = speed * (0.4 + random() * 0.8);
      particles.push({
        x, y,
        vx: Math.cos(angle) * velocity,
        vy: Math.sin(angle) * velocity - 40,
        life: 0.5 + random() * 0.4, maxLife: 0.9,
        color, size: 3 + random() * 4,
      });
    }
  }

  function reset() {
    player.x = SPAWN.x;
    player.y = SPAWN.y;
    player.facing = -Math.PI / 2;
    player.moving = false;
    player.wrenchT = 0;
    player.coffeeT = 0;
    player.mopProgress = 0;
    water.fill(0);
    wetList.length = 0;
    particles.length = 0;
    state.wetCells = 0;
    state.score = 0;
    state.fixedCount = 0;
    state.timeLeft = SHIFT_SECONDS;
    state.flood = 0;
    state.pressure = 0;
    state.tier = 0;
    state.elapsed = 0;
    state.drainTimer = WATER.drainInterval;
    state.extraBurstTimer = PIPE.extraBurstInterval;
    state.won = false;
    state.over = false;
    state.overReason = '';
    state.repairing = false;
    const points = burstPoints();
    state.pipes = points.slice(0, PIPE.count).map(burstPipe);
    state.spares = points.slice(PIPE.count, PIPE.maxBurst);
    state.burstCount = state.pipes.length;
    for (const pipe of state.pipes) seedPuddle(pipe);
    state.pickups = PICKUP_SPOTS.map((spot) => ({ x: spot.x, y: spot.y, kind: spot.kind, taken: false }));
  }

  function nearestBurstPipe() {
    let best = null;
    let bestDistance = Infinity;
    for (const pipe of state.pipes) {
      if (pipe.fixed) continue;
      const d = distance(player.x, player.y, pipe.x, pipe.y);
      if (d < bestDistance) {
        bestDistance = d;
        best = pipe;
      }
    }
    return bestDistance <= PLAYER.reach ? best : null;
  }

  function wetCellNearPlayer() {
    const c = cellOf(player.x, player.y);
    for (let row = c.row - 1; row <= c.row + 1; row += 1) {
      for (let col = c.col - 1; col <= c.col + 1; col += 1) {
        if (!isFloorCell(col, row)) continue;
        const index = cellIndex(col, row);
        if (water[index] > 0) return index;
      }
    }
    return -1;
  }

  function standingInWater() {
    const c = cellOf(player.x, player.y);
    if (!isFloorCell(c.col, c.row)) return false;
    return water[cellIndex(c.col, c.row)] > 0;
  }

  /**
   * One fixed step. `move` is {x, y} with each component -1, 0 or 1; `action`
   * is true while E is held (repair a burst pipe, else mop water). With
   * `harmless` set (the title screen's backdrop) pipes leak for show but the
   * flood, the pressure, the clock and the score all stand still.
   */
  function step(dt, move, action, harmless) {
    let events = 0;
    state.elapsed += dt;

    // Move, one axis at a time so a wall never stops both.
    let speed = player.coffeeT > 0 ? PLAYER.coffeeSpeed : PLAYER.speed;
    if (standingInWater()) speed *= PLAYER.waterSlow;
    const diagonal = move.x !== 0 && move.y !== 0 ? 0.7071 : 1;
    const dx = move.x * speed * diagonal * dt;
    const dy = move.y * speed * diagonal * dt;
    player.moving = dx !== 0 || dy !== 0;
    if (player.moving) player.facing = Math.atan2(move.y, move.x);
    if (dx !== 0 && !circleBlocked(map.blocked, player.x + dx, player.y, PLAYER.radius)) player.x += dx;
    if (dy !== 0 && !circleBlocked(map.blocked, player.x, player.y + dy, PLAYER.radius)) player.y += dy;
    if (player.wrenchT > 0) player.wrenchT = Math.max(0, player.wrenchT - dt);
    if (player.coffeeT > 0) player.coffeeT = Math.max(0, player.coffeeT - dt);

    // Pickups: walk over one to take it.
    for (const pickup of state.pickups) {
      if (pickup.taken) continue;
      if (distance(player.x, player.y, pickup.x, pickup.y) > 30) continue;
      pickup.taken = true;
      if (pickup.kind === 'wrench') {
        player.wrenchT = PICKUP.wrenchSeconds;
        state.score += PICKUP.pickupPoints;
      } else if (pickup.kind === 'coffee') {
        player.coffeeT = PICKUP.coffeeSeconds;
        state.score += PICKUP.pickupPoints;
      } else {
        state.score += PICKUP.duckPoints;
      }
      spawnParticles(pickup.x, pickup.y, '#f2c94c', 10, 120);
      events |= EVENT_PICKUP;
    }

    // Repair a burst pipe, else mop the water at the plumber's feet.
    if (action && !harmless) {
      const pipe = nearestBurstPipe();
      state.repairing = pipe !== null;
      if (pipe !== null) {
        const rate = player.wrenchT > 0 ? PLAYER.wrenchRepairRate : PLAYER.repairRate;
        pipe.health += rate * dt;
        player.facing = Math.atan2(pipe.y - player.y, pipe.x - player.x);
        if (random() < 0.25) spawnParticles(pipe.x, pipe.y, '#f2c94c', 1, 60);
        if (pipe.health >= PIPE.health) {
          pipe.health = PIPE.health;
          pipe.fixed = true;
          state.fixedCount += 1;
          state.score += PIPE.points;
          state.pressure = Math.max(0, state.pressure - PRESSURE.fixDrop);
          spawnParticles(pipe.x, pipe.y, '#7fc96b', 16, 160);
          events |= EVENT_FIX;
        }
      } else {
        const cell = wetCellNearPlayer();
        if (cell !== -1) {
          player.mopProgress += dt;
          if (player.mopProgress >= PLAYER.mopInterval) {
            player.mopProgress = 0;
            dryCell(cell);
            state.score += WATER.mopPoints;
            state.pressure = Math.max(0, state.pressure - PRESSURE.mopDrop);
            events |= EVENT_MOP;
          }
        } else {
          player.mopProgress = 0;
        }
      }
    } else {
      player.mopProgress = 0;
      state.repairing = false;
    }

    // Every open leak spreads water, one cell at a time.
    for (const pipe of state.pipes) {
      if (pipe.fixed) continue;
      pipe.leakTimer -= dt;
      if (pipe.leakTimer <= 0) {
        pipe.leakTimer += WATER.spreadInterval;
        if (harmless && state.wetCells < 60) spreadWater();
        else if (!harmless) spreadWater();
      }
    }

    // Fixed pipes let their water drain away, a cell at a time.
    if (!harmless && state.fixedCount > 0 && wetList.length > 0) {
      state.drainTimer -= dt;
      if (state.drainTimer <= 0) {
        state.drainTimer += WATER.drainInterval;
        dryCell(wetList[Math.floor(random() * wetList.length)]);
      }
    }

    state.flood = (state.wetCells / map.floorCells) * 100;

    if (!harmless) {
      // Pressure: the wanted-style gauge. Leaks and flood push it up; fixes
      // and mopping push it down. High pressure bursts new pipes.
      const activeLeaks = state.burstCount - state.fixedCount;
      state.pressure += (activeLeaks * PRESSURE.leakPerSecond + state.flood * PRESSURE.floodPerSecond) * dt;
      state.pressure = Math.max(0, Math.min(100, state.pressure));
      const tier = pressureTier(state.pressure);
      if (tier > state.tier && tier === PRESSURE.tiers.length - 1) events |= EVENT_ALARM;
      state.tier = tier;
      if (state.pressure >= PIPE.extraBurstAtPressure && state.burstCount < PIPE.maxBurst && state.spares.length > 0) {
        state.extraBurstTimer -= dt;
        if (state.extraBurstTimer <= 0) {
          state.extraBurstTimer = PIPE.extraBurstInterval;
          const pipe = burstPipe(state.spares.shift());
          state.pipes.push(pipe);
          state.burstCount += 1;
          seedPuddle(pipe);
          spawnParticles(pipe.x, pipe.y, '#e5534b', 12, 140);
          events |= EVENT_BURST;
        }
      }

      // The clock: run out with pipes still burst and the shift is lost.
      state.timeLeft -= dt;
      if (state.timeLeft <= 0) {
        state.timeLeft = 0;
        if (state.fixedCount < state.burstCount) {
          state.over = true;
          state.overReason = 'time';
          events |= EVENT_OVER;
        }
      }

      // Fix every burst pipe and the shift is won, with a time bonus.
      if (!state.over && state.fixedCount === state.burstCount && state.burstCount > 0) {
        state.won = true;
        state.score += Math.ceil(state.timeLeft) * SCORE.winTimeBonus;
        events |= EVENT_WIN;
      }

      // Too much water and the building floods.
      if (!state.over && !state.won && state.flood >= WATER.floodLose) {
        state.over = true;
        state.overReason = 'flood';
        events |= EVENT_OVER;
      }
    }

    // Particles drift and fade.
    for (let i = particles.length - 1; i >= 0; i -= 1) {
      const p = particles[i];
      p.life -= dt;
      if (p.life <= 0) {
        particles[i] = particles[particles.length - 1];
        particles.pop();
        continue;
      }
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vy += 160 * dt;
    }
    return events;
  }

  /** Distance to the nearest open leak, for the hiss volume; Infinity when dry. */
  function nearestLeakDistance() {
    let best = Infinity;
    for (const pipe of state.pipes) {
      if (pipe.fixed) continue;
      best = Math.min(best, distance(player.x, player.y, pipe.x, pipe.y));
    }
    return best;
  }

  reset();
  return { state, reset, step, nearestLeakDistance };
}
