const ROOMS = [
  { name: 'Sunset Apt', x: 0, y: 0, w: 13, h: 10, color: '#e9dcc3' },
  { name: 'Maple Apt', x: 13, y: 0, w: 13, h: 10, color: '#d7e4cf' },
  { name: 'Harbor Apt', x: 26, y: 0, w: 14, h: 10, color: '#cfdce9' },
  { name: 'Laundry', x: 0, y: 10, w: 13, h: 10, color: '#e9d5d5' },
  { name: 'Kitchen', x: 13, y: 10, w: 13, h: 10, color: '#e9e3c3' },
  { name: 'Storage', x: 26, y: 10, w: 14, h: 10, color: '#ddd6e9' },
  { name: 'Basement', x: 0, y: 20, w: 40, h: 10, color: '#c9cdd2' },
];

const FURNITURE = [
  { room: 0, x: 2, y: 2, w: 3, h: 2, color: '#8a6f4d', label: 'sofa' },
  { room: 0, x: 9, y: 7, w: 2, h: 2, color: '#7a5a3a', label: 'table' },
  { room: 1, x: 16, y: 2, w: 4, h: 2, color: '#5d7a52', label: 'bed' },
  { room: 1, x: 22, y: 7, w: 2, h: 2, color: '#6b5a7a', label: 'desk' },
  { room: 2, x: 29, y: 2, w: 3, h: 2, color: '#4d6a8a', label: 'sofa' },
  { room: 2, x: 36, y: 7, w: 2, h: 2, color: '#8a7a4d', label: 'table' },
  { room: 3, x: 2, y: 12, w: 3, h: 2, color: '#b0b8c0', label: 'washer' },
  { room: 3, x: 8, y: 16, w: 3, h: 2, color: '#b0b8c0', label: 'dryer' },
  { room: 4, x: 15, y: 12, w: 4, h: 2, color: '#a08a5a', label: 'counter' },
  { room: 4, x: 22, y: 17, w: 2, h: 2, color: '#8a6f4d', label: 'table' },
  { room: 5, x: 29, y: 12, w: 3, h: 3, color: '#9a8a6a', label: 'crates' },
  { room: 5, x: 35, y: 16, w: 3, h: 2, color: '#9a8a6a', label: 'crates' },
  { room: 6, x: 2, y: 22, w: 4, h: 2, color: '#7a7f85', label: 'boiler' },
  { room: 6, x: 34, y: 22, w: 4, h: 2, color: '#7a7f85', label: 'boiler' },
];

const PIPE_SPOTS = [
  { x: 6, y: 5, room: 0, spare: false },
  { x: 20, y: 4, room: 1, spare: false },
  { x: 33, y: 6, room: 2, spare: false },
  { x: 6, y: 15, room: 3, spare: false },
  { x: 20, y: 15, room: 4, spare: false },
  { x: 33, y: 15, room: 5, spare: false },
  { x: 10, y: 25, room: 6, spare: true },
  { x: 30, y: 25, room: 6, spare: true },
];

const PICKUP_SPOTS = {
  wrench: { x: 3, y: 25 },
  coffee: { x: 37, y: 25 },
  ducks: [
    { x: 2, y: 2 },
    { x: 38, y: 2 },
    { x: 20, y: 27 },
  ],
};

const PLAYER_START = { x: 20, y: 26 };

function buildMap() {
  const walls = new Set();
  const key = (x, y) => x + ',' + y;
  for (let x = 0; x < CONFIG.COLS; x++) {
    walls.add(key(x, 0));
    walls.add(key(x, CONFIG.ROWS - 1));
  }
  for (let y = 0; y < CONFIG.ROWS; y++) {
    walls.add(key(0, y));
    walls.add(key(CONFIG.COLS - 1, y));
  }
  const vDoors = { 13: [5, 15], 26: [4, 14] };
  for (const vx of [13, 26]) {
    for (let y = 1; y < 20; y++) {
      if (vDoors[vx].includes(y)) continue;
      walls.add(key(vx, y));
    }
  }
  const hDoors = { 10: [6, 20, 33], 20: [4, 18, 32] };
  for (const hy of [10, 20]) {
    for (let x = 1; x < CONFIG.COLS - 1; x++) {
      if (hDoors[hy].includes(x)) continue;
      walls.add(key(x, hy));
    }
  }
  return { walls, key };
}

function isWall(map, tx, ty) {
  if (tx < 0 || ty < 0 || tx >= CONFIG.COLS || ty >= CONFIG.ROWS) return true;
  return map.walls.has(map.key(tx, ty));
}
