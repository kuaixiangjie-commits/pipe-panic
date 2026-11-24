// Pipe Panic! — tuning constants. Times are seconds, lengths are pixels.
export const TILE = 40;
export const COLS = 40;
export const ROWS = 30;
export const MAP_W = COLS * TILE; // 1600
export const MAP_H = ROWS * TILE; // 1200
export const HUD_H = 64;

export const SHIFT_SECONDS = 180;
export const PIPE_COUNT = 6;
export const FLOOD_COVERAGE = 0.75;

export const PLAYER_R = 14;
export const PLAYER_SPEED = 230;
export const COFFEE_SPEED = 345;
export const REPAIR_RANGE = 62;
export const REPAIR_RATE = 0.55; // repair progress per second (a pipe takes ~1.8 s)
export const WRENCH_RATE = 1.15; // with the wrench (~0.9 s)
export const MOP_RADIUS = 72;
export const MOP_RATE = 1.0; // water removed per second per tile

export const PICKUP_DURATION = 12; // seconds a wrench / coffee boost lasts
export const PICKUP_RADIUS = 30;

export const POINTS_REPAIR = 200;
export const POINTS_DUCK = 50;
export const POINTS_MOP_TILE = 10;
export const TIME_BONUS_PER_SECOND = 10;
export const PRESSURE_FIX_DROP = 12;

export const WATER_INJECT = 0.6; // water per second into a burst pipe's tile
export const WATER_DIFFUSE = 0.9; // spread rate between neighbouring tiles
export const WATER_MOP_THRESHOLD = 0.25; // a tile counts as wet above this
export const PRESSURE_PER_LEAK = 0.22; // pressure per second, per burst pipe
export const PRESSURE_PER_COVERAGE = 5; // pressure per second, scaled by coverage
export const PRESSURE_IDLE_DRAIN = 0.5; // pressure drained per second with no leaks
export const REBURST_AT = 75; // pressure at which the FLOODING tier starts
export const REBURST_INTERVAL = 15; // seconds at FLOODING before a fixed pipe re-bursts
export const MAX_REBURSTS = 2; // re-bursts per game, so the shift stays winnable

export const TIERS = [
  { max: 25, name: "CALM" },
  { max: 50, name: "BUSY" },
  { max: 75, name: "RUSH" },
  { max: 101, name: "FLOODING" },
];

export function tierName(pressure) {
  for (const t of TIERS) {
    if (pressure < t.max) return t.name;
  }
  return "FLOODING";
}
