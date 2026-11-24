// Pipe Panic! — game loop and wiring.
import { CONFIG } from './config.js';
import { createWorld, updateWorld } from './world.js';
import { createInput } from './input.js';
import { render } from './render.js';
import { createSound } from './sound.js';
import { stageShot } from './shots.js';
import * as MAP from './map.js';

const params = new URLSearchParams(location.search);
const shot = params.get('shot');
const seed = parseInt(params.get('seed') || '7', 10) || 7;

let world = shot ? stageShot(shot, seed) : createWorld(seed);
try {
  world.best = parseInt(localStorage.getItem('pipe-panic-best') || '0', 10) || 0;
} catch (e) {
  world.best = 0;
}

const input = createInput();
const sound = createSound();
const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');

function startShift() {
  world = createWorld(seed);
  try {
    world.best = parseInt(localStorage.getItem('pipe-panic-best') || '0', 10) || 0;
  } catch (e) {
    world.best = 0;
  }
  world.screen = 'playing';
  sound.resume();
}

canvas.addEventListener('click', () => {
  if (world.screen === 'title' || world.screen === 'win' || world.screen === 'lose') {
    startShift();
  }
});

let last = performance.now();
function frame(now) {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;

  if (world.screen === 'title' && (input.wasPressed('Space') || input.wasPressed('Enter'))) {
    world.screen = 'playing';
    sound.resume();
  } else if (world.screen === 'playing' && (input.wasPressed('KeyP') || input.wasPressed('Escape'))) {
    world.screen = 'paused';
  } else if (world.screen === 'paused' && (input.wasPressed('KeyP') || input.wasPressed('Escape'))) {
    world.screen = 'playing';
  } else if ((world.screen === 'win' || world.screen === 'lose') && input.wasPressed('Space')) {
    startShift();
  }

  updateWorld(world, input, dt, sound);
  render(ctx, world);
  input.endFrame();
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

// Playtest hook: state snapshot, walkable grid, and pathfinding.
window.__pp = {
  world,
  input,
  state() {
    return {
      screen: world.screen,
      px: world.player.x,
      py: world.player.y,
      timeLeft: world.timeLeft,
      elapsed: world.elapsed,
      score: world.score,
      best: world.best,
      coverage: world.coverage,
      pressure: world.pressure,
      tier: world.pressureTier,
      loseReason: world.loseReason,
      ducksGot: world.ducksGot,
      pipes: world.pipes.map((p) => ({ x: p.x, y: p.y, tx: p.tx, ty: p.ty, fixed: p.fixed, progress: p.progress })),
      pickups: world.pickups.map((p) => ({ x: p.x, y: p.y, kind: p.kind, taken: p.taken })),
    };
  },
  grid() {
    const walkable = [];
    for (let ty = 0; ty < CONFIG.ROWS; ty++) {
      for (let tx = 0; tx < CONFIG.COLS; tx++) {
        walkable.push(MAP.walkable(tx, ty) ? 1 : 0);
      }
    }
    return { cols: CONFIG.COLS, rows: CONFIG.ROWS, walkable };
  },
  findPath(tx, ty) {
    const fromTx = Math.floor(world.player.x / CONFIG.TILE);
    const fromTy = Math.floor(world.player.y / CONFIG.TILE);
    return MAP.findPath(fromTx, fromTy, tx, ty);
  },
};
