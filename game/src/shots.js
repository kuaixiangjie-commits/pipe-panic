// Pipe Panic! — staged scenes for screenshots (?shot=start|play|end&seed=N).
// A staged scene is frozen (the simulation does not run) so the same seed
// always shows the same layout. The live game never uses these.
import { COLS, ROWS } from "./config.js";
import { mulberry32, randInt } from "./random.js";

export function applyShot(world, search) {
  const params = new URLSearchParams(search);
  const shot = params.get("shot");
  if (!shot) return false;
  const seed = Number(params.get("seed") || "7") || 7;
  const rng = mulberry32(seed);
  world.reset();
  world.frozen = true;

  if (shot === "start") {
    // Title scene: two pipes burst, a little water, Pip at the lobby door.
    const burstIds = [0, 3];
    for (const p of world.pipes) p.burst = burstIds.includes(p.id);
    sprinkleWater(world, rng, 40);
    world.screen = "title";
  } else if (shot === "play") {
    // Mid-game: three pipes fixed, three burst, water spreading, 1:36 left.
    const fixedIds = new Set();
    while (fixedIds.size < 3) fixedIds.add(randInt(rng, 0, 5));
    for (const p of world.pipes) p.burst = !fixedIds.has(p.id);
    sprinkleWater(world, rng, 260);
    world.timeLeft = 96;
    world.score = 650 + randInt(rng, 0, 90);
    world.player.x = 780;
    world.player.y = 620;
    world.wrenchTime = 6;
    world.screen = "playing";
  } else if (shot === "end") {
    // Win scene: all six pipes fixed, a little water left, score with bonus.
    for (const p of world.pipes) {
      p.burst = false;
      p.progress = 0;
    }
    sprinkleWater(world, rng, 60);
    world.timeLeft = 41;
    world.score = 1840;
    world.timeBonus = 410;
    world.won = true;
    world.best = Math.max(world.best, world.score);
    world.screen = "win";
  } else {
    world.frozen = false;
    return false;
  }
  world.settlePressure();
  return true;
}

// Deterministic puddles on random floor tiles.
function sprinkleWater(world, rng, count) {
  const floor = [];
  for (let ty = 0; ty < ROWS; ty++) {
    for (let tx = 0; tx < COLS; tx++) {
      if (world.grid[ty][tx] === 0) floor.push(ty * COLS + tx);
    }
  }
  for (let i = 0; i < count; i++) {
    const idx = floor[Math.floor(rng() * floor.length)];
    world.water[idx] = 0.35 + rng() * 0.6;
  }
}
