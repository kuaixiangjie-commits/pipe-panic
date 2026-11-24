// Pipe Panic! — tuning constants for a 180-second shift.
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
export const REPAIR_RATE = 0.55; // progress per second (a pipe takes ~1.8 s)
export const WRENCH_RATE = 1.15; // with the wrench (~0.9 s)
export const MOP_RADIUS = 72;
export const MOP_RATE = 1.0; // water removed per second per tile

export const PICKUP_DURATION = 12; // seconds a wrench / coffee lasts
export const POINTS_REPAIR = 200;
export const POINTS_DUCK = 50;
export const POINTS_MOP_PER_UNIT = 10; // points per 1.0 water mopped up
export const POINTS_TIME_BONUS = 10; // per second left when the shift is won

export const WATER_INJECT = 0.8; // water per second into a burst pipe's tile
export const WATER_DIFFUSE = 1.6; // relax rate toward the neighborhood average
export const WATER_COVER_THRESHOLD = 0.3; // a tile counts as wet above this

export const PRESSURE_CALM = 25;
export const PRESSURE_BUSY = 50;
export const PRESSURE_RUSH = 75;
export const REBURST_MIN_GAP = 20; // seconds between re-bursts
export const REBURST_CHANCE = 0.08; // per second while pressure is at RUSH or worse

export const BEST_KEY = "pipe-panic-best";
