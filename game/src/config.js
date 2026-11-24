const CONFIG = {
  TILE: 40,
  COLS: 40,
  ROWS: 30,
  WIDTH: 1600,
  HEIGHT: 1200,
  TIME_LIMIT: 180,
  WATER_FAIL: 75,
  REPAIR_TIME: 2.5,
  MOP_RATE: 3,
  WATER_PER_BURST: 0.25,
  PLAYER_SPEED: 220,
  PLAYER_SPEED_COFFEE: 310,
  WRENCH_TIME: 12,
  COFFEE_TIME: 12,
  DUCK_POINTS: 50,
  REPAIR_POINTS: 150,
  REPAIR_RANGE: 64,
  PICKUP_RANGE: 30,
};

const TIERS = [
  { name: 'CALM', until: 60, bonus: 0 },
  { name: 'BUSY', until: 120, bonus: 0.05 },
  { name: 'RUSH', until: 150, bonus: 0.1 },
  { name: 'FLOODING', until: 1e9, bonus: 0.2 },
];

function tierFor(elapsed) {
  for (const t of TIERS) {
    if (elapsed < t.until) return t;
  }
  return TIERS[TIERS.length - 1];
}
