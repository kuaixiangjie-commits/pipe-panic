// Pipe Panic! — the Harborview Apartments floor plan.
// Grid 40 x 30 tiles of 40 px. Outer wall ring, three rooms up top, a
// hallway, three rooms below. Doors are gaps in the wall rows/columns.
import { CONFIG } from './config.js';

const { COLS, ROWS, TILE } = CONFIG;

export const ROOMS = [
  { name: 'Apt 1 · Maple', x: 1, y: 1, w: 12, h: 9, color: '#e8dcc0' },
  { name: 'Laundry', x: 14, y: 1, w: 7, h: 9, color: '#cfe0e8' },
  { name: 'Apt 2 · Birch', x: 22, y: 1, w: 17, h: 9, color: '#e8dcc0' },
  { name: 'Hallway', x: 1, y: 11, w: 38, h: 4, color: '#d8d2c4' },
  { name: 'Apt 4 · Cedar', x: 1, y: 16, w: 12, h: 13, color: '#e8dcc0' },
  { name: 'Lobby', x: 14, y: 16, w: 7, h: 13, color: '#d8e8d0' },
  { name: 'Apt 5 · Willow', x: 22, y: 16, w: 17, h: 13, color: '#e8dcc0' },
];

// Furniture: solid rectangles in tile coordinates.
export const FURNITURE = [
  { x: 2, y: 2, w: 4, h: 2, label: 'bed' },
  { x: 8, y: 2, w: 3, h: 2, label: 'table' },
  { x: 2, y: 6, w: 4, h: 1, label: 'sofa' },
  { x: 15, y: 1, w: 2, h: 1, label: 'washer' },
  { x: 18, y: 1, w: 2, h: 1, label: 'washer' },
  { x: 15, y: 8, w: 2, h: 1, label: 'dryer' },
  { x: 24, y: 2, w: 4, h: 2, label: 'bed' },
  { x: 30, y: 2, w: 3, h: 2, label: 'table' },
  { x: 36, y: 2, w: 1, h: 1, label: 'plant' },
  { x: 24, y: 7, w: 4, h: 1, label: 'sofa' },
  { x: 2, y: 17, w: 4, h: 2, label: 'bed' },
  { x: 8, y: 17, w: 3, h: 2, label: 'table' },
  { x: 2, y: 26, w: 2, h: 1, label: 'shelf' },
  { x: 15, y: 17, w: 5, h: 1, label: 'counter' },
  { x: 19, y: 26, w: 1, h: 1, label: 'plant' },
  { x: 24, y: 17, w: 4, h: 2, label: 'bed' },
  { x: 30, y: 17, w: 3, h: 2, label: 'table' },
  { x: 24, y: 26, w: 4, h: 1, label: 'sofa' },
  { x: 35, y: 17, w: 2, h: 1, label: 'tv' },
];

// The six burst pipes (tile coordinates). Every spot is open floor:
// a pipe on a furniture tile could never be reached.
export const PIPE_SPOTS = [
  { tx: 11, ty: 6 },
  { tx: 17, ty: 4 },
  { tx: 33, ty: 6 },
  { tx: 4, ty: 20 },
  { tx: 17, ty: 22 },
  { tx: 30, ty: 24 },
];

// Pickups: wrench, coffee, and three hidden rubber ducks.
export const PICKUP_SPOTS = [
  { kind: 'wrench', tx: 15, ty: 7 },
  { kind: 'coffee', tx: 19, ty: 18 },
  { kind: 'duck', tx: 2, ty: 8 },
  { kind: 'duck', tx: 37, ty: 8 },
  { kind: 'duck', tx: 37, ty: 27 },
];

export const PLAYER_START = { x: (19 + 0.5) * TILE, y: (12 + 0.5) * TILE };

const WALLS = new Set();
function buildWalls() {
  for (let x = 0; x < COLS; x++) {
    WALLS.add(`${x},0`);
    WALLS.add(`${x},${ROWS - 1}`);
  }
  for (let y = 0; y < ROWS; y++) {
    WALLS.add(`0,${y}`);
    WALLS.add(`${COLS - 1},${y}`);
  }
  // Horizontal wall rows with door gaps.
  for (let x = 1; x <= 38; x++) {
    if (x !== 6 && x !== 17 && x !== 30) WALLS.add(`${x},10`);
    if (x !== 6 && x !== 17 && x !== 30) WALLS.add(`${x},15`);
  }
  // Vertical walls between rooms, with door gaps.
  for (let y = 1; y <= 9; y++) {
    if (y !== 5) WALLS.add(`13,${y}`);
    if (y !== 5) WALLS.add(`21,${y}`);
  }
  for (let y = 16; y <= 28; y++) {
    if (y !== 22) WALLS.add(`13,${y}`);
    if (y !== 22) WALLS.add(`21,${y}`);
  }
}
buildWalls();

const FURNITURE_TILES = new Set();
for (const f of FURNITURE) {
  for (let y = f.y; y < f.y + f.h; y++) {
    for (let x = f.x; x < f.x + f.w; x++) FURNITURE_TILES.add(`${x},${y}`);
  }
}

export function isWallTile(tx, ty) {
  if (tx < 0 || ty < 0 || tx >= COLS || ty >= ROWS) return true;
  return WALLS.has(`${tx},${ty}`);
}

export function isFurnitureTile(tx, ty) {
  return FURNITURE_TILES.has(`${tx},${ty}`);
}

export function isSolidTile(tx, ty) {
  return isWallTile(tx, ty) || isFurnitureTile(tx, ty);
}

export function walkable(tx, ty) {
  return !isSolidTile(tx, ty);
}

export function tileCenter(tx, ty) {
  return { x: (tx + 0.5) * TILE, y: (ty + 0.5) * TILE };
}

// Circle (x, y, r) against solid tiles: true when it overlaps one.
export function collides(x, y, r) {
  const x0 = Math.floor((x - r) / TILE);
  const x1 = Math.floor((x + r) / TILE);
  const y0 = Math.floor((y - r) / TILE);
  const y1 = Math.floor((y + r) / TILE);
  for (let ty = y0; ty <= y1; ty++) {
    for (let tx = x0; tx <= x1; tx++) {
      if (!isSolidTile(tx, ty)) continue;
      const cx = Math.max(tx * TILE, Math.min(x, tx * TILE + TILE));
      const cy = Math.max(ty * TILE, Math.min(y, ty * TILE + TILE));
      const dx = x - cx;
      const dy = y - cy;
      if (dx * dx + dy * dy < r * r) return true;
    }
  }
  return false;
}

// Move a circle by (dx, dy) with axis separation and corner assist:
// when blocked, try small perpendicular nudges so the player slides
// around door frames instead of wedging on a corner.
export function moveWithCollision(x, y, dx, dy, r) {
  const nudges = [0, 3, -3, 6, -6, 9, -9, 12, -12];
  let nx = x;
  let ny = y;
  if (dx !== 0) {
    let moved = false;
    for (const n of nudges) {
      if (!collides(x + dx, y + n, r)) {
        nx = x + dx;
        ny = y + n;
        moved = true;
        break;
      }
    }
    if (!moved) {
      nx = x;
      ny = y;
    }
  }
  if (dy !== 0) {
    let moved = false;
    for (const n of nudges) {
      if (!collides(nx + n, ny + dy, r)) {
        nx = nx + n;
        ny = ny + dy;
        moved = true;
        break;
      }
    }
    if (!moved) {
      // keep the x movement already applied
    }
  }
  return { x: nx, y: ny };
}

// Breadth-first path over walkable tiles, from tile to tile.
// Returns an array of pixel waypoints (tile centers), excluding the start.
export function findPath(fromTx, fromTy, toTx, toTy) {
  if (!walkable(toTx, toTy)) return null;
  const key = (x, y) => y * COLS + x;
  const prev = new Map();
  const seen = new Set([key(fromTx, fromTy)]);
  const queue = [[fromTx, fromTy]];
  prev.set(key(fromTx, fromTy), null);
  while (queue.length > 0) {
    const [cx, cy] = queue.shift();
    if (cx === toTx && cy === toTy) {
      const path = [];
      let cur = [cx, cy];
      while (cur !== null) {
        path.unshift(tileCenter(cur[0], cur[1]));
        cur = prev.get(key(cur[0], cur[1]));
      }
      path.shift(); // drop the start tile
      return path;
    }
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = cx + dx;
      const ny = cy + dy;
      if (!walkable(nx, ny) || seen.has(key(nx, ny))) continue;
      seen.add(key(nx, ny));
      prev.set(key(nx, ny), [cx, cy]);
      queue.push([nx, ny]);
    }
  }
  return null;
}
