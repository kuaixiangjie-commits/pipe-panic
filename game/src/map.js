// The floor plan of Harborview Apartments, ground floor, in Copperton.
// One building, seven rooms, copper pipe runs along the walls. Walls and
// furniture block movement; doors are gaps in the walls. The floor is a grid
// of 40px cells: the grid answers "is this cell blocked?" for movement and
// for the water spread, and it carries the breadth-first search the
// screenshot autopilot walks with.

import { CELL, GRID_COLS, GRID_ROWS, WORLD } from './config.js';

/** Walls: rectangles 40 thick. Every room stays reachable through a door gap. */
const WALLS = [
  // Outer shell.
  { x: 0, y: 0, w: 1600, h: 40 },
  { x: 0, y: 1160, w: 1600, h: 40 },
  { x: 0, y: 0, w: 40, h: 1200 },
  { x: 1560, y: 0, w: 40, h: 1200 },
  // Horizontal wall y=400, from the left edge to x=1000; door at x 560-640.
  { x: 0, y: 400, w: 560, h: 40 },
  { x: 640, y: 400, w: 360, h: 40 },
  // Horizontal wall y=800, from x=600 to the right edge; door at x 1000-1080.
  { x: 600, y: 800, w: 400, h: 40 },
  { x: 1080, y: 800, w: 520, h: 40 },
  // Vertical wall x=800, top half; door at y 160-240.
  { x: 800, y: 0, w: 40, h: 160 },
  { x: 800, y: 240, w: 40, h: 200 },
  // Vertical wall x=400, middle; door at y 560-640.
  { x: 400, y: 400, w: 40, h: 160 },
  { x: 400, y: 640, w: 40, h: 160 },
  // Vertical wall x=1200, middle; door at y 560-640.
  { x: 1200, y: 400, w: 40, h: 160 },
  { x: 1200, y: 640, w: 40, h: 160 },
  // Vertical wall x=800, bottom half; door at y 960-1040.
  { x: 800, y: 800, w: 40, h: 160 },
  { x: 800, y: 1040, w: 40, h: 160 },
];

/** Rooms, for the floor tint and the rug: name, bounds, floor kind, rug or null. */
export const ROOMS = [
  { name: 'Boiler room', x: 40, y: 40, w: 760, h: 360, floor: 'tile', rug: null },
  { name: 'Flat A', x: 840, y: 40, w: 720, h: 360, floor: 'wood', rug: { x: 1000, y: 150, w: 280, h: 160 } },
  { name: 'Laundry', x: 40, y: 440, w: 360, h: 360, floor: 'tile', rug: null },
  { name: 'Lobby', x: 440, y: 440, w: 760, h: 360, floor: 'wood', rug: { x: 700, y: 560, w: 320, h: 180 } },
  { name: 'Kitchen', x: 1240, y: 440, w: 320, h: 360, floor: 'tile', rug: null },
  { name: 'Flat B', x: 40, y: 840, w: 760, h: 320, floor: 'wood', rug: { x: 200, y: 920, w: 280, h: 160 } },
  { name: 'Storage', x: 840, y: 840, w: 720, h: 320, floor: 'tile', rug: null },
];

/** Furniture: solid blocks the plumber walks around. Kept clear of every door. */
export const FURNITURE = [
  { x: 120, y: 120, w: 200, h: 120, kind: 'boiler' }, // boiler room plant
  { x: 120, y: 280, w: 120, h: 80, kind: 'crate' },
  { x: 1320, y: 120, w: 160, h: 80, kind: 'bed' }, // Flat A
  { x: 900, y: 300, w: 200, h: 60, kind: 'sofa' },
  { x: 80, y: 480, w: 240, h: 80, kind: 'washer' }, // laundry machines
  { x: 80, y: 640, w: 120, h: 80, kind: 'crate' },
  { x: 1280, y: 480, w: 240, h: 90, kind: 'counter' }, // kitchen counter
  { x: 560, y: 480, w: 160, h: 80, kind: 'table' }, // lobby table
  { x: 960, y: 680, w: 160, h: 60, kind: 'sofa' },
  { x: 120, y: 880, w: 160, h: 80, kind: 'bed' }, // Flat B
  { x: 560, y: 1000, w: 160, h: 80, kind: 'table' },
  { x: 900, y: 880, w: 240, h: 90, kind: 'crate' }, // storage crates
  { x: 1240, y: 1000, w: 200, h: 80, kind: 'crate' },
];

/** Copper pipe runs along the walls: line segments the burst points sit on. */
export const PIPE_RUNS = [
  { x1: 100, y1: 62, x2: 1500, y2: 62 }, // top wall
  { x1: 62, y1: 100, x2: 62, y2: 1100 }, // left wall
  { x1: 100, y1: 462, x2: 1100, y2: 462 }, // below the y=400 wall
  { x1: 1538, y1: 100, x2: 1538, y2: 1100 }, // right wall
  { x1: 100, y1: 1138, x2: 1500, y2: 1138 }, // bottom wall
  { x1: 862, y1: 462, x2: 862, y2: 1138 }, // vertical, right of the x=800 wall
];

/** The plumber clocks in here: the middle of the lobby. */
export const SPAWN = { x: 800, y: 620 };

function rectsOverlap(a, b) {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}

export function buildMap() {
  const blocked = new Uint8Array(GRID_COLS * GRID_ROWS);
  let floorCells = 0;
  for (let row = 0; row < GRID_ROWS; row += 1) {
    for (let col = 0; col < GRID_COLS; col += 1) {
      const cell = { x: col * CELL, y: row * CELL, w: CELL, h: CELL };
      let hit = false;
      for (let i = 0; i < WALLS.length && !hit; i += 1) hit = rectsOverlap(cell, WALLS[i]);
      for (let i = 0; i < FURNITURE.length && !hit; i += 1) hit = rectsOverlap(cell, FURNITURE[i]);
      blocked[row * GRID_COLS + col] = hit ? 1 : 0;
      if (!hit) floorCells += 1;
    }
  }
  return { walls: WALLS, furniture: FURNITURE, rooms: ROOMS, blocked, floorCells };
}

/** Cell indices for a point, clamped into the grid. */
export function cellOf(x, y) {
  return {
    col: Math.max(0, Math.min(GRID_COLS - 1, Math.floor(x / CELL))),
    row: Math.max(0, Math.min(GRID_ROWS - 1, Math.floor(y / CELL))),
  };
}

export function isBlockedCell(blocked, col, row) {
  if (col < 0 || col >= GRID_COLS || row < 0 || row >= GRID_ROWS) return true;
  return blocked[row * GRID_COLS + col] === 1;
}

/**
 * Is a circle of `radius` at (x, y) touching anything solid? Checks the cells
 * the circle's box overlaps, so a wall corner cannot be clipped.
 */
export function circleBlocked(blocked, x, y, radius) {
  const left = Math.floor((x - radius) / CELL);
  const right = Math.floor((x + radius) / CELL);
  const top = Math.floor((y - radius) / CELL);
  const bottom = Math.floor((y + radius) / CELL);
  for (let row = top; row <= bottom; row += 1) {
    for (let col = left; col <= right; col += 1) {
      if (isBlockedCell(blocked, col, row)) return true;
    }
  }
  return false;
}

/**
 * Breadth-first search over the floor grid: a list of cell-centre waypoints from
 * (fromX, fromY) to (toX, toY), or null when no path exists. Four-way moves,
 * so the path never cuts a wall corner.
 */
export function findPath(blocked, fromX, fromY, toX, toY) {
  const start = cellOf(fromX, fromY);
  const goal = cellOf(toX, toY);
  const startIndex = start.row * GRID_COLS + start.col;
  const goalIndex = goal.row * GRID_COLS + goal.col;
  if (startIndex === goalIndex) return [{ x: toX, y: toY }];
  if (blocked[goalIndex] === 1) return null;
  const cameFrom = new Int32Array(GRID_COLS * GRID_ROWS).fill(-1);
  const queue = [startIndex];
  cameFrom[startIndex] = startIndex;
  let head = 0;
  const DIRS = [[1, 0], [-1, 0], [0, 1], [0, -1]];
  while (head < queue.length) {
    const current = queue[head];
    head += 1;
    if (current === goalIndex) break;
    const col = current % GRID_COLS;
    const row = Math.floor(current / GRID_COLS);
    for (let i = 0; i < DIRS.length; i += 1) {
      const nextCol = col + DIRS[i][0];
      const nextRow = row + DIRS[i][1];
      if (nextCol < 0 || nextCol >= GRID_COLS || nextRow < 0 || nextRow >= GRID_ROWS) continue;
      const next = nextRow * GRID_COLS + nextCol;
      if (cameFrom[next] !== -1 || blocked[next] === 1) continue;
      cameFrom[next] = current;
      queue.push(next);
    }
  }
  if (cameFrom[goalIndex] === -1) return null;
  const path = [];
  let at = goalIndex;
  while (at !== startIndex) {
    path.push({ x: (at % GRID_COLS) * CELL + CELL / 2, y: Math.floor(at / GRID_COLS) * CELL + CELL / 2 });
    at = cameFrom[at];
  }
  path.reverse();
  path.push({ x: toX, y: toY });
  return path;
}

/** A point on a pipe run is usable when the floor beside it can be stood on. */
export function pipePointIsOpen(blocked, x, y) {
  const spots = [[0, 44], [0, -44], [44, 0], [-44, 0]];
  for (let i = 0; i < spots.length; i += 1) {
    const c = cellOf(x + spots[i][0], y + spots[i][1]);
    if (!isBlockedCell(blocked, c.col, c.row)) return true;
  }
  return false;
}

export function clampToWorld(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

export { WORLD };
