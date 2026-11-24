// Pipe Panic! — the Harborview Apartments floor plan.
// Tile kinds: 0 = floor, 1 = wall, 2 = furniture (solid, drawn as furniture).
import { COLS, ROWS, TILE } from "./config.js";

export function buildGrid() {
  const g = [];
  for (let y = 0; y < ROWS; y++) {
    const row = [];
    for (let x = 0; x < COLS; x++) {
      row.push(x === 0 || y === 0 || x === COLS - 1 || y === ROWS - 1 ? 1 : 0);
    }
    g.push(row);
  }
  const hWall = (y, x0, x1, gaps) => {
    for (let x = x0; x <= x1; x++) if (!gaps.includes(x)) g[y][x] = 1;
  };
  const vWall = (x, y0, y1, gaps) => {
    for (let y = y0; y <= y1; y++) if (!gaps.includes(y)) g[y][x] = 1;
  };
  const furn = (x, y, w, h) => {
    for (let j = y; j < y + h; j++) for (let i = x; i < x + w; i++) g[j][i] = 2;
  };
  // Walls between the top apartments and the hallway, and between the
  // hallway and the bottom rooms. The gaps are the doors.
  hWall(11, 1, 38, [6, 19, 32]);
  hWall(17, 1, 38, [6, 19, 32]);
  // Walls between apartments (gaps are interior doors).
  vWall(13, 1, 10, [5]);
  vWall(26, 1, 10, [5]);
  vWall(13, 18, 28, [23]);
  vWall(26, 18, 28, [23]);
  // Furniture: sofas, tables, beds, laundry machines, benches, a desk, a plant.
  furn(3, 3, 2, 1);
  furn(9, 8, 2, 1);
  furn(16, 2, 2, 1);
  furn(22, 2, 2, 1);
  furn(30, 3, 2, 1);
  furn(35, 8, 2, 1);
  furn(10, 14, 2, 1);
  furn(28, 14, 2, 1);
  furn(3, 20, 2, 2);
  furn(30, 20, 2, 2);
  furn(18, 20, 2, 1);
  furn(9, 25, 2, 1);
  furn(35, 25, 2, 1);
  furn(19, 26, 1, 1);
  return g;
}

// Seven rooms: three apartments and a laundry room upstairs, a hallway in
// the middle, two apartments and a lobby downstairs.
export const ROOMS = [
  { name: "Apt 1 · Maple", x0: 1, y0: 1, x1: 12, y1: 10, color: "#d9c9a3" },
  { name: "Laundry", x0: 14, y0: 1, x1: 25, y1: 10, color: "#b7cdd9" },
  { name: "Apt 2 · Birch", x0: 27, y0: 1, x1: 38, y1: 10, color: "#d9b3a0" },
  { name: "Hallway", x0: 1, y0: 12, x1: 38, y1: 16, color: "#c9c9b3" },
  { name: "Apt 4 · Cedar", x0: 1, y0: 18, x1: 12, y1: 28, color: "#c6b3d9" },
  { name: "Lobby", x0: 14, y0: 18, x1: 25, y1: 28, color: "#b3d9b3" },
  { name: "Apt 5 · Willow", x0: 27, y0: 18, x1: 38, y1: 28, color: "#d9c9a3" },
];

export function roomAt(tx, ty) {
  for (let i = 0; i < ROOMS.length; i++) {
    const r = ROOMS[i];
    if (tx >= r.x0 && tx <= r.x1 && ty >= r.y0 && ty <= r.y1) return i;
  }
  return -1;
}

// Six burst pipes, one in each room except the lobby.
export const PIPES = [
  { id: 0, tx: 6, ty: 4, room: 0 },
  { id: 1, tx: 19, ty: 6, room: 1 },
  { id: 2, tx: 32, ty: 4, room: 2 },
  { id: 3, tx: 19, ty: 14, room: 3 },
  { id: 4, tx: 6, ty: 24, room: 4 },
  { id: 5, tx: 32, ty: 24, room: 6 },
];

export const PICKUPS = [
  { kind: "wrench", tx: 15, ty: 24 },
  { kind: "coffee", tx: 35, ty: 13 },
  { kind: "duck", tx: 11, ty: 2 },
  { kind: "duck", tx: 28, ty: 9 },
  { kind: "duck", tx: 28, ty: 27 },
];

export const PLAYER_START = { tx: 20, ty: 26 };

export function tileCenter(tx, ty) {
  return { x: tx * TILE + TILE / 2, y: ty * TILE + TILE / 2 };
}
