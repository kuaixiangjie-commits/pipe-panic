// Deterministic staged scenes for screenshots: ?shot=start|play|end&seed=N
import { COLS, ROWS } from "./config.js";
import { mulberry32, randInt } from "./random.js";
import { tileCenter } from "./map.js";

export function applyShot(world, search) {
  const params = new URLSearchParams(search);
  const shot = params.get("shot");
  if (!shot) return false;
  const seed = Number(params.get("seed") || 7) >>> 0;
  const rng = mulberry32(seed);

  if (shot === "start") {
    world.screen = "title";
    return true;
  }

  if (shot === "play") {
    world.screen = "playing";
    world.timeLeft = 95;
    world.score = 450;
    world.ducks = 1;
    world.pressure = 55;
    // Two pipes already fixed (shuffled deterministically), the rest burst.
    const order = [...world.pipes];
    for (let i = order.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      const tmp = order[i];
      order[i] = order[j];
      order[j] = tmp;
    }
    order[0].burst = false;
    order[0].progress = 1;
    order[1].burst = false;
    order[1].progress = 1;
    // Standing water pooled around the burst pipes.
    for (const p of world.pipes) {
      if (!p.burst) continue;
      for (let k = 0; k < 14; k++) {
        const tx = Math.max(0, Math.min(COLS - 1, p.tx + randInt(rng, -3, 3)));
        const ty = Math.max(0, Math.min(ROWS - 1, p.ty + randInt(rng, -3, 3)));
        if (world.grid[ty][tx] === 0) world.water[ty * COLS + tx] = 0.4 + rng() * 0.5;
      }
    }
    let wet = 0;
    let floor = 0;
    for (let ty = 0; ty < ROWS; ty++) {
      for (let tx = 0; tx < COLS; tx++) {
        if (world.grid[ty][tx] !== 0) continue;
        floor++;
        if (world.water[ty * COLS + tx] > 0.25) wet++;
      }
    }
    world.coverage = floor ? wet / floor : 0;
    // Pip mid-map, wrench in hand.
    const c = tileCenter(20, 14);
    world.player.x = c.x;
    world.player.y = c.y;
    world.effects.wrench = 8;
    world.pickups[2].taken = true; // the one duck already collected
    return true;
  }

  if (shot === "end") {
    for (const p of world.pipes) {
      p.burst = false;
      p.progress = 1;
    }
    world.screen = "win";
    world.result = "win";
    world.score = 2714;
    world.timeLeft = 42;
    world.timeBonus = 420;
    world.coverage = 0.12;
    world.pressure = 18;
    return true;
  }

  return false;
}
