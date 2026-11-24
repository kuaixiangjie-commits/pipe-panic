function createWorld(seed) {
  const rng = makeRng(seed);
  const map = buildMap();
  const pipes = PIPE_SPOTS.map((s) => ({
    x: s.x,
    y: s.y,
    room: s.room,
    spare: s.spare,
    state: s.spare ? 'ok' : 'burst',
    progress: 0,
  }));
  return {
    seed,
    rng,
    map,
    pipes,
    elapsed: 0,
    timeLeft: CONFIG.TIME_LIMIT,
    water: 0,
    score: 0,
    mopScore: 0,
    fixedInitial: 0,
    ducksGot: 0,
    wrenchUntil: 0,
    coffeeUntil: 0,
    wrenchTaken: false,
    coffeeTaken: false,
    ducksTaken: [false, false, false],
    player: {
      x: (PLAYER_START.x + 0.5) * CONFIG.TILE,
      y: (PLAYER_START.y + 0.5) * CONFIG.TILE,
      r: 14,
    },
    over: false,
    won: false,
    loseReason: '',
    timeBonus: 0,
  };
}

function burstCount(w) {
  let n = 0;
  for (const p of w.pipes) if (p.state === 'burst') n++;
  return n;
}

function isWetTile(w, tx, ty) {
  for (const p of w.pipes) {
    if (p.state !== 'burst') continue;
    if (Math.abs(p.x - tx) <= 1 && Math.abs(p.y - ty) <= 1) return true;
  }
  return false;
}

function nearestBurstPipe(w, maxDist) {
  let best = null;
  let bd = maxDist;
  for (const p of w.pipes) {
    if (p.state !== 'burst') continue;
    const d = Math.hypot(p.x * CONFIG.TILE + CONFIG.TILE / 2 - w.player.x, p.y * CONFIG.TILE + CONFIG.TILE / 2 - w.player.y);
    if (d < bd) {
      bd = d;
      best = p;
    }
  }
  return best;
}

function movePlayer(w, dt, keys) {
  let dx = 0;
  let dy = 0;
  if (keys['KeyA'] || keys['ArrowLeft']) dx -= 1;
  if (keys['KeyD'] || keys['ArrowRight']) dx += 1;
  if (keys['KeyW'] || keys['ArrowUp']) dy -= 1;
  if (keys['KeyS'] || keys['ArrowDown']) dy += 1;
  if (!dx && !dy) return;
  const len = Math.hypot(dx, dy);
  dx /= len;
  dy /= len;
  const speed = w.elapsed < w.coffeeUntil ? CONFIG.PLAYER_SPEED_COFFEE : CONFIG.PLAYER_SPEED;
  const p = w.player;
  const stepX = dx * speed * dt;
  const stepY = dy * speed * dt;
  if (!hitsWall(w, p.x + stepX, p.y, p.r)) p.x += stepX;
  if (!hitsWall(w, p.x, p.y + stepY, p.r)) p.y += stepY;
  p.x = Math.max(p.r + 2, Math.min(CONFIG.WIDTH - p.r - 2, p.x));
  p.y = Math.max(p.r + 2, Math.min(CONFIG.HEIGHT - p.r - 2, p.y));
}

function hitsWall(w, x, y, r) {
  const corners = [
    [x - r, y - r],
    [x + r, y - r],
    [x - r, y + r],
    [x + r, y + r],
  ];
  for (const [cx, cy] of corners) {
    const tx = Math.floor(cx / CONFIG.TILE);
    const ty = Math.floor(cy / CONFIG.TILE);
    if (isWall(w.map, tx, ty)) return true;
  }
  return false;
}

function collectPickups(w) {
  const p = w.player;
  const near = (tx, ty) => Math.hypot(tx * CONFIG.TILE + CONFIG.TILE / 2 - p.x, ty * CONFIG.TILE + CONFIG.TILE / 2 - p.y) < CONFIG.PICKUP_RANGE + 10;
  if (!w.wrenchTaken && near(PICKUP_SPOTS.wrench.x, PICKUP_SPOTS.wrench.y)) {
    w.wrenchTaken = true;
    w.wrenchUntil = w.elapsed + CONFIG.WRENCH_TIME;
    Sound.pickup();
  }
  if (!w.coffeeTaken && near(PICKUP_SPOTS.coffee.x, PICKUP_SPOTS.coffee.y)) {
    w.coffeeTaken = true;
    w.coffeeUntil = w.elapsed + CONFIG.COFFEE_TIME;
    Sound.pickup();
  }
  PICKUP_SPOTS.ducks.forEach((d, i) => {
    if (!w.ducksTaken[i] && near(d.x, d.y)) {
      w.ducksTaken[i] = true;
      w.ducksGot++;
      w.score += CONFIG.DUCK_POINTS;
      Sound.pickup();
    }
  });
}

function updateWorld(w, dt, keys) {
  if (w.over) return;
  dt = Math.min(dt, 0.05);
  w.elapsed += dt;
  w.timeLeft = Math.max(0, CONFIG.TIME_LIMIT - w.elapsed);
  const tier = tierFor(w.elapsed);

  movePlayer(w, dt, keys);
  collectPickups(w);

  const wrenchOn = w.elapsed < w.wrenchUntil;
  const pipe = nearestBurstPipe(w, CONFIG.REPAIR_RANGE);
  if (keys['KeyE'] && pipe) {
    pipe.progress += (dt * (wrenchOn ? 2 : 1)) / CONFIG.REPAIR_TIME;
    if (pipe.progress >= 1) {
      pipe.state = 'fixed';
      pipe.progress = 0;
      w.score += CONFIG.REPAIR_POINTS;
      if (!pipe.spare) w.fixedInitial++;
      Sound.repair();
    }
  } else if (keys['KeyE']) {
    const tx = Math.floor(w.player.x / CONFIG.TILE);
    const ty = Math.floor(w.player.y / CONFIG.TILE);
    if (isWetTile(w, tx, ty) && w.water > 0) {
      const mopped = Math.min(w.water, CONFIG.MOP_RATE * dt);
      w.water -= mopped;
      w.mopScore += mopped * 2;
    }
  }

  const active = burstCount(w);
  w.water += (active * CONFIG.WATER_PER_BURST + tier.bonus) * dt;
  if (w.water > 100) w.water = 100;

  if (tier.name === 'BUSY' || tier.name === 'RUSH' || tier.name === 'FLOODING') {
    const chance = tier.name === 'BUSY' ? 0.02 : 0.06;
    for (const p of w.pipes) {
      if (p.spare && p.state === 'ok' && w.rng.chance(chance * dt)) {
        p.state = 'burst';
        Sound.burst();
      }
    }
  }

  if (w.fixedInitial >= 6 && active === 0) {
    w.won = true;
    w.over = true;
    w.timeBonus = Math.round(w.timeLeft) * 5;
    w.score += w.timeBonus + Math.round(w.mopScore);
    Sound.win();
    return;
  }
  if (w.water >= CONFIG.WATER_FAIL) {
    w.won = false;
    w.over = true;
    w.loseReason = 'flood';
    Sound.lose();
    return;
  }
  if (w.timeLeft <= 0) {
    w.won = false;
    w.over = true;
    w.loseReason = 'timeout';
    Sound.lose();
  }
}
