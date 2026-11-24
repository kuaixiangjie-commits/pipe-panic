let world = null;
let screen = 'title';
let lastTs = 0;
let seed = 7;
let shot = '';

function params() {
  const q = new URLSearchParams(location.search);
  seed = parseInt(q.get('seed') || '7', 10) || 7;
  shot = q.get('shot') || '';
}

function startGame() {
  world = createWorld(seed);
  screen = 'playing';
  lastTs = performance.now();
  Sound.init();
  try {
    if (world.score === 0) {
      const best = localStorage.getItem('pipe-panic-best');
      if (best === null) localStorage.setItem('pipe-panic-best', '0');
    }
  } catch (e) {
    // storage may be unavailable; ignore
  }
}

function loop(ts) {
  const dt = lastTs ? (ts - lastTs) / 1000 : 0.016;
  lastTs = ts;
  if (screen === 'playing' && world) {
    updateWorld(world, dt, Input.keys);
    if (world.over) {
      screen = world.won ? 'win' : 'lose';
      if (world.won) {
        try {
          const best = parseInt(localStorage.getItem('pipe-panic-best') || '0', 10);
          if (world.score > best) localStorage.setItem('pipe-panic-best', String(world.score));
        } catch (e) {
          // ignore
        }
      }
    }
  }
  const canvas = document.getElementById('game');
  const ctx = canvas.getContext('2d');
  if (world) render(ctx, world, screen);
  requestAnimationFrame(loop);
}

function boot() {
  params();
  Input.init();
  world = createWorld(seed);
  if (shot === 'start') {
    screen = 'title';
  } else if (shot === 'play') {
    applyShot(world, 'play');
    screen = 'playing';
  } else if (shot === 'end') {
    applyShot(world, 'end');
    screen = 'win';
  } else {
    screen = 'title';
  }
  addEventListener('keydown', (e) => {
    Sound.init();
    if (e.code === 'Enter' || e.code === 'Space') {
      if (screen === 'title' || screen === 'win' || screen === 'lose') startGame();
    }
    if (e.code === 'KeyP' || e.code === 'Escape') {
      if (screen === 'playing') screen = 'paused';
      else if (screen === 'paused') screen = 'playing';
    }
    if (e.code === 'KeyR') {
      if (screen === 'win' || screen === 'lose') startGame();
    }
  });
  addEventListener('pointerdown', () => Sound.init());
  const canvas = document.getElementById('game');
  canvas.addEventListener('click', () => {
    if (screen === 'title' || screen === 'win' || screen === 'lose') startGame();
  });
  requestAnimationFrame(loop);
  window.__ppReady = true;
}

window.__pp = {
  start() {
    startGame();
  },
  world() {
    return world;
  },
  screen() {
    return screen;
  },
  state() {
    return {
      screen,
      over: world ? world.over : false,
      won: world ? world.won : false,
      loseReason: world ? world.loseReason : '',
      score: world ? world.score : 0,
      timeLeft: world ? world.timeLeft : 0,
      water: world ? world.water : 0,
      pipesFixed: world ? world.fixedInitial : 0,
      bursts: world ? burstCount(world) : 0,
      ducks: world ? world.ducksGot : 0,
    };
  },
  warp(tx, ty) {
    if (!world) return;
    world.player.x = (tx + 0.5) * CONFIG.TILE;
    world.player.y = (ty + 0.5) * CONFIG.TILE;
  },
  keys: Input.keys,
};

document.addEventListener('DOMContentLoaded', boot);
