// Harborview Apartments: a 40x30 tile map (1600x1200 px).
// Grid values: 0 = floor, 1 = wall, 2 = furniture (solid obstacle).
import { COLS, ROWS, TILE } from "./config.js";

export function buildGrid() {
  const g = [];
  for (let y = 0; y < ROWS; y++) g.push(new Array(COLS).fill(0));

  const wall = (x0, y0, x1, y1) => {
    for (let y = y0; y <= y1; y++) {
      for (let x = x0; x <= x1; x++) g[y][x] = 1;
    }
  };
  const door = (x, y) => {
    g[y][x] = 0;
  };

  // Outer border.
  wall(0, 0, COLS - 1, 0);
  wall(0, ROWS - 1, COLS - 1, ROWS - 1);
  wall(0, 0, 0, ROWS - 1);
  wall(COLS - 1, 0, COLS - 1, ROWS - 1);

  // Horizontal walls between the floors (y=10 above the hallway, y=19 below it).
  wall(1, 10, COLS - 2, 10);
  wall(1, 19, COLS - 2, 19);
  // Two-tile-wide doors in each horizontal wall.
  for (const dx of [6, 19, 32]) {
    door(dx, 10);
    door(dx + 1, 10);
    door(dx, 19);
    door(dx + 1, 19);
  }

  // Vertical walls between the apartments, top row (y=1..9) and bottom row (y=20..28).
  wall(13, 1, 13, 9);
  wall(26, 1, 26, 9);
  wall(13, 20, 13, 28);
  wall(26, 20, 26, 28);
  door(13, 5);
  door(26, 5);
  door(13, 24);
  door(26, 24);

  // Furniture: beds, tables, washers, a reception desk. Kept clear of doors,
  // pipes, pickups and the player start so every room stays reachable.
  const furniture = [
    [2, 2], [3, 2], [10, 2], // Apt 1 Maple
    [15, 2], [16, 2], [23, 2], // Laundry washers
    [28, 2], [36, 2], [37, 2], // Apt 2 Birch
    [8, 12], [31, 16], // Hallway bench + plant
    [2, 21], [10, 27], // Apt 4 Cedar
    [15, 21], [16, 21], [24, 27], // Lobby desk + plant
    [28, 27], [36, 21], [37, 21], // Apt 5 Willow
  ];
  for (const [x, y] of furniture) g[y][x] = 2;
  return g;
}

export const ROOMS = [
  { name: "Apt 1 · Maple", x0: 1, y0: 1, x1: 12, y1: 9 },
  { name: "Laundry", x0: 14, y0: 1, x1: 25, y1: 9 },
  { name: "Apt 2 · Birch", x0: 27, y0: 1, x1: 38, y1: 9 },
  { name: "Hallway", x0: 1, y0: 11, x1: 38, y1: 18 },
  { name: "Apt 4 · Cedar", x0: 1, y0: 20, x1: 12, y1: 28 },
  { name: "Lobby", x0: 14, y0: 20, x1: 25, y1: 28 },
  { name: "Apt 5 · Willow", x0: 27, y0: 20, x1: 38, y1: 28 },
];

export function roomAt(tx, ty) {
  for (const r of ROOMS) {
    if (tx >= r.x0 && tx <= r.x1 && ty >= r.y0 && ty <= r.y1) return r.name;
  }
  return null;
}

// The six burst pipes, one per room except the lobby.
export const PIPES = [
  { tx: 4, ty: 3, room: "Apt 1 · Maple" },
  { tx: 19, ty: 2, room: "Laundry" },
  { tx: 34, ty: 4, room: "Apt 2 · Birch" },
  { tx: 20, ty: 14, room: "Hallway" },
  { tx: 5, ty: 25, room: "Apt 4 · Cedar" },
  { tx: 33, ty: 26, room: "Apt 5 · Willow" },
];

export const PICKUPS = [
  { tx: 10, ty: 7, kind: "wrench" },
  { tx: 30, ty: 7, kind: "coffee" },
  { tx: 2, ty: 27, kind: "duck" },
  { tx: 24, ty: 13, kind: "duck" },
  { tx: 37, ty: 22, kind: "duck" },
];

export const PLAYER_START = { tx: 20, ty: 26 };

export function tileCenter(tx, ty) {
  return { x: tx * TILE + TILE / 2, y: ty * TILE + TILE / 2 };
}
