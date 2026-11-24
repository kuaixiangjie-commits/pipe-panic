// Pipe Panic! — every tuning number and colour in one place.
// The world is a 1600x1200 apartment floor in the harbour town of Copperton;
// the camera shows a 1280x720 view of it and follows the plumber. The renderer
// scales the view to the window, so no rule below depends on the screen size.

export const VIEW = { width: 1280, height: 720 };
export const WORLD = { width: 1600, height: 1200 };
export const CELL = 40;
export const GRID_COLS = WORLD.width / CELL; // 40
export const GRID_ROWS = WORLD.height / CELL; // 30

/** The simulation's fixed step, in seconds: 60 updates a second whatever the display's rate. */
export const STEP = 1 / 60;

/** One shift: fix every burst pipe before the clock runs out. */
export const SHIFT_SECONDS = 180;

export const PLAYER = {
  radius: 16,
  speed: 235,
  coffeeSpeed: 305,
  repairRate: 34, // pipe health per second while holding E beside a burst pipe
  wrenchRepairRate: 68,
  mopInterval: 0.12, // seconds of holding E to mop one water cell dry
  waterSlow: 0.62, // speed factor while standing in water
  reach: 64, // how close a burst pipe must be to repair it
};

export const PIPE = {
  count: 6, // burst pipes at the start of a shift
  maxBurst: 8, // high pressure can burst more pipes mid-shift
  health: 100,
  points: 100,
  extraBurstAtPressure: 60, // pressure at or above this can burst a new pipe
  extraBurstInterval: 25, // seconds between extra bursts while pressure is high
};

export const WATER = {
  spreadInterval: 0.9, // seconds between one new wet cell per active leak
  drainInterval: 0.5, // seconds between one cell drying once its pipe is fixed
  mopPoints: 5,
  floodLose: 75, // flood percent that ends the shift in failure
};

export const PRESSURE = {
  leakPerSecond: 0.55, // pressure gained per second per active leak
  floodPerSecond: 0.02, // pressure gained per second per flood percent point
  fixDrop: 6, // pressure lost when a pipe is fixed
  mopDrop: 0.4, // pressure lost per mopped cell
  tiers: [
    { at: 0, name: 'CALM' },
    { at: 35, name: 'BUSY' },
    { at: 60, name: 'RUSH' },
    { at: 85, name: 'FLOODING' },
  ],
};

export const PICKUP = {
  wrenchSeconds: 12,
  coffeeSeconds: 12,
  duckPoints: 50,
  pickupPoints: 25,
};

export const SCORE = {
  winTimeBonus: 5, // points per second left on the clock when the shift is won
};

export const PALETTE = {
  backdrop: '#14181f',
  floorWood: '#8a6b4f',
  floorWoodDark: '#7d6046',
  floorTile: '#b9a58c',
  floorTileDark: '#ab9478',
  rug: '#a34d3f',
  rugEdge: '#7e3a30',
  wall: '#e8dcc8',
  wallTrim: '#b3a586',
  furniture: '#6b4f35',
  furnitureTop: '#7d5c3e',
  boiler: '#5d6b73',
  boilerDark: '#46545b',
  pipe: '#7fae9e',
  pipeDark: '#5d8a7d',
  burst: '#e5534b',
  waterShallow: 'rgba(63, 169, 214, 0.55)',
  waterDeep: 'rgba(31, 120, 178, 0.75)',
  player: '#e8823a',
  playerDark: '#b45f22',
  cap: '#2e4a6b',
  skin: '#e8b98a',
  wrench: '#c8ccd2',
  coffee: '#f2c94c',
  duck: '#f2d13d',
  panel: '#252b38',
  text: '#eef1f5',
  muted: '#8b93a3',
  danger: '#e5534b',
  ok: '#7fc96b',
};

export const FONT = 'system-ui, -apple-system, "Segoe UI", sans-serif';

/** Where the best score is kept between visits (this browser only). */
export const BEST_KEY = 'pipe-panic.best';
