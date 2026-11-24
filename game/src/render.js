// Drawing only: the world's state and the current screen in, pixels out. The
// camera follows the plumber through the 1600x1200 floor; the 1280x720 view is
// scaled to fit the window and centred, the margin filled with the backdrop
// colour. Flat shapes and canvas text throughout: every pipe, wall, rug and
// face is drawn by hand here, no image is ever loaded.

import { CELL, FONT, GRID_COLS, GRID_ROWS, PALETTE, PLAYER, PRESSURE, VIEW, WORLD } from './config.js';
import { PIPE_RUNS, cellOf } from './map.js';
import { pressureTier } from './world.js';

export const SCREEN_TITLE = 'title';
export const SCREEN_PLAY = 'play';
export const SCREEN_PAUSED = 'paused';
export const SCREEN_WIN = 'win';
export const SCREEN_OVER = 'over';

const PANEL = { width: 640, top: 140, line: 34, bottom: 72 };
const MAP = { width: 200, height: 150, x: VIEW.width - 216, y: VIEW.height - 166 };
const MAP_SCALE = MAP.width / WORLD.width; // 0.125

function cachedLabel(prefix) {
  let value = -1;
  let text = '';
  return function label(next) {
    if (next !== value) {
      value = next;
      text = prefix + next;
    }
    return text;
  };
}

export function createRenderer(canvas) {
  const context = canvas.getContext('2d');
  const view = { scale: 1, x: 0, y: 0 };
  const scoreLabel = cachedLabel('SCORE ');
  const bestLabel = cachedLabel('BEST ');
  const pipesLabel = cachedLabel('PIPES ');
  const finalLabel = cachedLabel('SCORE ');
  const timeLabel = cachedLabel('');

  function resize() {
    const ratio = window.devicePixelRatio || 1;
    const width = Math.round(window.innerWidth * ratio);
    const height = Math.round(window.innerHeight * ratio);
    canvas.width = width;
    canvas.height = height;
    view.scale = Math.min(width / VIEW.width, height / VIEW.height);
    view.x = (width - VIEW.width * view.scale) / 2;
    view.y = (height - VIEW.height * view.scale) / 2;
  }

  const fonts = new Map();
  function text(value, x, y, size, color, align) {
    if (!fonts.has(size)) fonts.set(size, `${size}px ${FONT}`);
    context.font = fonts.get(size);
    context.fillStyle = color;
    context.textAlign = align;
    context.fillText(value, x, y);
  }

  function bar(x, y, w, h, frac, color, back) {
    context.fillStyle = back;
    context.fillRect(x, y, w, h);
    context.fillStyle = color;
    context.fillRect(x, y, Math.max(0, Math.min(1, frac)) * w, h);
  }

  function formatTime(seconds) {
    const total = Math.max(0, Math.ceil(seconds));
    return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`;
  }

  function drawRooms(state) {
    const rooms = state.map.rooms;
    for (let i = 0; i < rooms.length; i += 1) {
      const room = rooms[i];
      context.fillStyle = room.floor === 'wood' ? PALETTE.floorWood : PALETTE.floorTile;
      context.fillRect(room.x, room.y, room.w, room.h);
      // Wood planks or tile seams, one faint line per cell.
      context.fillStyle = room.floor === 'wood' ? PALETTE.floorWoodDark : PALETTE.floorTileDark;
      if (room.floor === 'wood') {
        for (let y = room.y + 32; y < room.y + room.h; y += 32) context.fillRect(room.x, y, room.w, 2);
      } else {
        for (let x = room.x + CELL; x < room.x + room.w; x += CELL) context.fillRect(x, room.y, 2, room.h);
        for (let y = room.y + CELL; y < room.y + room.h; y += CELL) context.fillRect(room.x, y, room.w, 2);
      }
      if (room.rug !== null) {
        context.fillStyle = PALETTE.rug;
        context.fillRect(room.rug.x, room.rug.y, room.rug.w, room.rug.h);
        context.strokeStyle = PALETTE.rugEdge;
        context.lineWidth = 4;
        context.strokeRect(room.rug.x + 6, room.rug.y + 6, room.rug.w - 12, room.rug.h - 12);
      }
    }
  }

  function drawWalls(state) {
    for (const wall of state.map.walls) {
      context.fillStyle = PALETTE.wall;
      context.fillRect(wall.x, wall.y, wall.w, wall.h);
      context.fillStyle = PALETTE.wallTrim;
      if (wall.h <= CELL) context.fillRect(wall.x, wall.y + wall.h - 4, wall.w, 4);
      else context.fillRect(wall.x + wall.w - 4, wall.y, 4, wall.h);
    }
  }

  function drawPipes(state) {
    for (const run of PIPE_RUNS) {
      context.strokeStyle = PALETTE.pipe;
      context.lineWidth = 10;
      context.beginPath();
      context.moveTo(run.x1, run.y1);
      context.lineTo(run.x2, run.y2);
      context.stroke();
      context.strokeStyle = PALETTE.pipeDark;
      context.lineWidth = 3;
      context.beginPath();
      context.moveTo(run.x1, run.y1);
      context.lineTo(run.x2, run.y2);
      context.stroke();
    }
    for (const pipe of state.pipes) {
      if (pipe.fixed) {
        context.fillStyle = PALETTE.ok;
        context.beginPath();
        context.arc(pipe.x, pipe.y, 7, 0, Math.PI * 2);
        context.fill();
        continue;
      }
      // A burst pipe: red joint, pulsing, spraying droplets.
      const pulse = 0.6 + 0.4 * Math.sin(state.elapsed * 6 + pipe.spraySeed);
      context.fillStyle = PALETTE.burst;
      context.beginPath();
      context.arc(pipe.x, pipe.y, 9 + 3 * pulse, 0, Math.PI * 2);
      context.fill();
      context.fillStyle = 'rgba(255,255,255,0.85)';
      for (let i = 0; i < 6; i += 1) {
        const angle = pipe.spraySeed + i * (Math.PI / 3) + state.elapsed * 2;
        const dist = 14 + 10 * Math.abs(Math.sin(state.elapsed * 3 + i));
        context.beginPath();
        context.arc(pipe.x + Math.cos(angle) * dist, pipe.y + Math.sin(angle) * dist, 2.5, 0, Math.PI * 2);
        context.fill();
      }
      // Repair progress ring while the plumber works on it.
      if (pipe.health > 0 && pipe.health < 100) {
        context.strokeStyle = '#ffffff';
        context.lineWidth = 4;
        context.beginPath();
        context.arc(pipe.x, pipe.y, 20, -Math.PI / 2, -Math.PI / 2 + (pipe.health / 100) * Math.PI * 2);
        context.stroke();
      }
    }
  }

  function drawWater(state) {
    const water = state.water;
    for (let index = 0; index < water.length; index += 1) {
      const depth = water[index];
      if (depth === 0) continue;
      const col = index % GRID_COLS;
      const row = Math.floor(index / GRID_COLS);
      context.fillStyle = depth === 1 ? PALETTE.waterShallow : PALETTE.waterDeep;
      context.fillRect(col * CELL + 1, row * CELL + 1, CELL - 2, CELL - 2);
      if (depth === 2) {
        context.fillStyle = 'rgba(255,255,255,0.25)';
        const shimmer = (Math.sin(state.elapsed * 2 + index) + 1) / 2;
        context.fillRect(col * CELL + 6, row * CELL + 6 + shimmer * 8, CELL - 12, 3);
      }
    }
  }

  function drawFurniture(state) {
    for (const item of state.map.furniture) {
      context.fillStyle = item.kind === 'boiler' ? PALETTE.boiler : PALETTE.furniture;
      context.fillRect(item.x, item.y, item.w, item.h);
      context.fillStyle = item.kind === 'boiler' ? PALETTE.boilerDark : PALETTE.furnitureTop;
      context.fillRect(item.x, item.y, item.w, 10);
      if (item.kind === 'boiler') {
        context.fillStyle = '#d8dee2';
        for (let i = 0; i < 3; i += 1) {
          context.beginPath();
          context.arc(item.x + 40 + i * 60, item.y + 60, 14, 0, Math.PI * 2);
          context.fill();
        }
      } else if (item.kind === 'washer') {
        context.fillStyle = '#d8dee2';
        context.beginPath();
        context.arc(item.x + 60, item.y + 40, 22, 0, Math.PI * 2);
        context.fill();
        context.beginPath();
        context.arc(item.x + 180, item.y + 40, 22, 0, Math.PI * 2);
        context.fill();
      } else if (item.kind === 'bed') {
        context.fillStyle = '#e8dcc8';
        context.fillRect(item.x + 10, item.y + 10, 50, item.h - 20);
      } else if (item.kind === 'crate') {
        context.strokeStyle = 'rgba(0,0,0,0.35)';
        context.lineWidth = 3;
        context.beginPath();
        context.moveTo(item.x, item.y);
        context.lineTo(item.x + item.w, item.y + item.h);
        context.moveTo(item.x + item.w, item.y);
        context.lineTo(item.x, item.y + item.h);
        context.stroke();
      }
    }
  }

  function drawPickups(state) {
    for (const pickup of state.pickups) {
      if (pickup.taken) continue;
      const bob = Math.sin(state.elapsed * 3 + pickup.x) * 3;
      if (pickup.kind === 'wrench') {
        context.fillStyle = PALETTE.wrench;
        context.fillRect(pickup.x - 12, pickup.y - 4 + bob, 24, 8);
        context.beginPath();
        context.arc(pickup.x + 14, pickup.y + bob, 7, 0, Math.PI * 2);
        context.fill();
      } else if (pickup.kind === 'coffee') {
        context.fillStyle = '#ffffff';
        context.fillRect(pickup.x - 8, pickup.y - 10 + bob, 16, 18);
        context.fillStyle = PALETTE.coffee;
        context.fillRect(pickup.x - 8, pickup.y - 10 + bob, 16, 6);
      } else {
        context.fillStyle = PALETTE.duck;
        context.beginPath();
        context.arc(pickup.x, pickup.y + bob, 10, 0, Math.PI * 2);
        context.fill();
        context.beginPath();
        context.arc(pickup.x + 8, pickup.y - 4 + bob, 5, 0, Math.PI * 2);
        context.fill();
      }
    }
  }

  function drawPlayer(state) {
    const player = state.player;
    context.fillStyle = 'rgba(0,0,0,0.3)';
    context.beginPath();
    context.ellipse(player.x, player.y + 14, 18, 7, 0, 0, Math.PI * 2);
    context.fill();
    // Overalls.
    context.fillStyle = PALETTE.player;
    context.fillRect(player.x - 13, player.y - 10, 26, 26);
    context.fillStyle = PALETTE.playerDark;
    context.fillRect(player.x - 13, player.y - 10, 5, 26);
    context.fillRect(player.x + 8, player.y - 10, 5, 26);
    // Head and cap, brim toward the facing.
    context.fillStyle = PALETTE.skin;
    context.beginPath();
    context.arc(player.x, player.y - 16, 11, 0, Math.PI * 2);
    context.fill();
    context.fillStyle = PALETTE.cap;
    context.beginPath();
    context.arc(player.x, player.y - 18, 11, Math.PI, 0);
    context.fill();
    context.fillRect(
      player.x + Math.cos(player.facing) * 8 - 5,
      player.y - 18 + Math.sin(player.facing) * 8 - 3,
      10, 6,
    );
    // The wrench, swinging while a repair is under way.
    const pipe = nearestPipeInReach(state);
    if (pipe !== null) {
      const swing = Math.sin(state.elapsed * 14) * 0.5;
      const angle = player.facing + swing;
      context.save();
      context.translate(player.x + Math.cos(player.facing) * 22, player.y + Math.sin(player.facing) * 22);
      context.rotate(angle);
      context.fillStyle = PALETTE.wrench;
      context.fillRect(0, -3, 18, 6);
      context.beginPath();
      context.arc(20, 0, 6, 0, Math.PI * 2);
      context.fill();
      context.restore();
    }
    // Ripple while standing in water.
    const c = cellOf(player.x, player.y);
    if (state.water[c.row * GRID_COLS + c.col] > 0) {
      context.strokeStyle = 'rgba(255,255,255,0.5)';
      context.lineWidth = 2;
      context.beginPath();
      context.arc(player.x, player.y, 24 + 4 * Math.sin(state.elapsed * 4), 0, Math.PI * 2);
      context.stroke();
    }
  }

  function drawParticles(state) {
    for (const p of state.particles) {
      context.globalAlpha = Math.max(0, p.life / p.maxLife);
      context.fillStyle = p.color;
      context.fillRect(p.x - p.size / 2, p.y - p.size / 2, p.size, p.size);
    }
    context.globalAlpha = 1;
  }

  function nearestPipeInReach(state) {
    let best = null;
    let bestDistance = Infinity;
    for (const pipe of state.pipes) {
      if (pipe.fixed) continue;
      const dx = pipe.x - state.player.x;
      const dy = pipe.y - state.player.y;
      const d = Math.sqrt(dx * dx + dy * dy);
      if (d < bestDistance) {
        bestDistance = d;
        best = pipe;
      }
    }
    return bestDistance <= PLAYER.reach ? best : null;
  }

  function drawField(state) {
    drawRooms(state);
    drawWalls(state);
    drawPipes(state);
    drawWater(state);
    drawFurniture(state);
    drawPickups(state);
    drawPlayer(state);
    drawParticles(state);
  }

  function drawHud(state) {
    context.fillStyle = 'rgba(20,24,31,0.72)';
    context.fillRect(0, 0, VIEW.width, 76);
    context.textBaseline = 'top';
    text(scoreLabel(state.score), 24, 12, 28, PALETTE.text, 'left');
    text(bestLabel(state.best || 0), 24, 44, 16, PALETTE.muted, 'left');
    const time = formatTime(state.timeLeft);
    text(timeLabel(time), VIEW.width / 2, 14, 34, state.timeLeft < 30 ? PALETTE.danger : PALETTE.text, 'center');
    text('SHIFT', VIEW.width / 2, 50, 14, PALETTE.muted, 'center');
    text(pipesLabel(`${state.fixedCount} / ${state.burstCount}`), VIEW.width - 24, 10, 20, PALETTE.text, 'right');
    text('FLOOD', 990, 36, 13, PALETTE.muted, 'left');
    bar(1060, 36, 196, 12, state.flood / 100, state.flood > 50 ? PALETTE.danger : '#3fa9d6', 'rgba(255,255,255,0.15)');
    text('PRESSURE', 990, 56, 13, PALETTE.muted, 'left');
    const tier = PRESSURE.tiers[state.tier];
    bar(1060, 56, 196, 12, state.pressure / 100, state.tier >= 3 ? PALETTE.danger : state.tier >= 2 ? '#e8823a' : '#7fc96b', 'rgba(255,255,255,0.15)');
    text(tier.name, 1060, 56, 12, '#ffffff', 'left');
    // Active pickups.
    let chipX = 24;
    context.textBaseline = 'top';
    if (state.player.wrenchT > 0) {
      const label = `WRENCH x2  ${Math.ceil(state.player.wrenchT)}s`;
      context.fillStyle = 'rgba(242,201,76,0.9)';
      context.fillRect(chipX, VIEW.height - 40, 150, 26);
      text(label, chipX + 10, VIEW.height - 35, 15, '#1d211a', 'left');
      chipX += 162;
    }
    if (state.player.coffeeT > 0) {
      const label = `COFFEE +SPEED  ${Math.ceil(state.player.coffeeT)}s`;
      context.fillStyle = 'rgba(127,201,107,0.9)';
      context.fillRect(chipX, VIEW.height - 40, 190, 26);
      text(label, chipX + 10, VIEW.height - 35, 15, '#1d211a', 'left');
    }
    // Red pulse while the pressure is at FLOODING.
    if (state.tier >= 3) {
      const alpha = 0.25 + 0.2 * Math.sin(state.elapsed * 6);
      context.strokeStyle = `rgba(229,83,75,${alpha.toFixed(3)})`;
      context.lineWidth = 10;
      context.strokeRect(5, 5, VIEW.width - 10, VIEW.height - 10);
    }
  }

  function drawMinimap(state) {
    context.fillStyle = 'rgba(20,24,31,0.8)';
    context.fillRect(MAP.x - 4, MAP.y - 20, MAP.width + 8, MAP.height + 24);
    text('MAP — HARBORVIEW APTS', MAP.x, MAP.y - 18, 12, PALETTE.muted, 'left');
    context.fillStyle = '#2a3040';
    context.fillRect(MAP.x, MAP.y, MAP.width, MAP.height);
    for (const room of state.map.rooms) {
      context.fillStyle = room.floor === 'wood' ? '#3a332a' : '#3d4149';
      context.fillRect(MAP.x + room.x * MAP_SCALE, MAP.y + room.y * MAP_SCALE, room.w * MAP_SCALE, room.h * MAP_SCALE);
    }
    for (const index of state.wetList) {
      const col = index % GRID_COLS;
      const row = Math.floor(index / GRID_COLS);
      context.fillStyle = '#3fa9d6';
      context.fillRect(MAP.x + col * CELL * MAP_SCALE, MAP.y + row * CELL * MAP_SCALE, 5, 5);
    }
    for (const run of PIPE_RUNS) {
      context.strokeStyle = PALETTE.pipe;
      context.lineWidth = 2;
      context.beginPath();
      context.moveTo(MAP.x + run.x1 * MAP_SCALE, MAP.y + run.y1 * MAP_SCALE);
      context.lineTo(MAP.x + run.x2 * MAP_SCALE, MAP.y + run.y2 * MAP_SCALE);
      context.stroke();
    }
    for (const pickup of state.pickups) {
      if (pickup.taken) continue;
      context.fillStyle = '#f2c94c';
      context.fillRect(MAP.x + pickup.x * MAP_SCALE - 2, MAP.y + pickup.y * MAP_SCALE - 2, 4, 4);
    }
    for (const pipe of state.pipes) {
      if (pipe.fixed) continue;
      context.fillStyle = PALETTE.burst;
      context.beginPath();
      context.arc(MAP.x + pipe.x * MAP_SCALE, MAP.y + pipe.y * MAP_SCALE, 4, 0, Math.PI * 2);
      context.fill();
    }
    context.fillStyle = '#ffffff';
    context.beginPath();
    context.arc(MAP.x + state.player.x * MAP_SCALE, MAP.y + state.player.y * MAP_SCALE, 4, 0, Math.PI * 2);
    context.fill();
    context.strokeStyle = '#1d211a';
    context.lineWidth = 1;
    context.beginPath();
    context.arc(MAP.x + state.player.x * MAP_SCALE, MAP.y + state.player.y * MAP_SCALE, 5, 0, Math.PI * 2);
    context.stroke();
  }

  function drawPanel(title, lines, prompt) {
    const height = PANEL.top + lines.length * PANEL.line + PANEL.bottom;
    const x = (VIEW.width - PANEL.width) / 2;
    const y = (VIEW.height - height) / 2;
    context.fillStyle = PALETTE.panel;
    context.fillRect(x, y, PANEL.width, height);
    context.textBaseline = 'alphabetic';
    text(title, VIEW.width / 2, y + 78, 48, PALETTE.text, 'center');
    for (let index = 0; index < lines.length; index += 1) {
      text(lines[index], VIEW.width / 2, y + PANEL.top + index * PANEL.line, 22, PALETTE.muted, 'center');
    }
    text(prompt, VIEW.width / 2, y + height - 40, 24, '#f2c94c', 'center');
  }

  const TITLE_LINES = [
    'Rain night in Copperton. The old pipes of Harborview',
    'Apartments burst all at once, and you are the plumber',
    'on call. Fix every burst pipe before the water wins.',
    'Move with WASD or arrows. Hold E to repair, or to mop.',
    'Watch the pressure gauge: high pressure bursts new pipes.',
    '',
  ];
  const PAUSED_LINES = ['The leaks will wait for you.'];
  const WIN_LINES = ['', '', ''];
  const OVER_LINES = ['', '', ''];

  /** Paint one frame: the floor, then the HUD or a panel for the screen. */
  function draw(state, screen, best) {
    state.best = best;
    const camX = Math.max(0, Math.min(WORLD.width - VIEW.width, state.player.x - VIEW.width / 2));
    const camY = Math.max(0, Math.min(WORLD.height - VIEW.height, state.player.y - VIEW.height / 2));
    context.setTransform(1, 0, 0, 1, 0, 0);
    context.fillStyle = PALETTE.backdrop;
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.setTransform(view.scale, 0, 0, view.scale, view.x - camX * view.scale, view.y - camY * view.scale);
    drawField(state);
    context.setTransform(view.scale, 0, 0, view.scale, view.x, view.y);
    if (screen === SCREEN_TITLE) {
      TITLE_LINES[5] = bestLabel(best);
      drawPanel('PIPE PANIC!', TITLE_LINES, 'Press Space or click to start');
      return;
    }
    drawHud(state);
    drawMinimap(state);
    if (screen === SCREEN_PAUSED) {
      drawPanel('Paused', PAUSED_LINES, 'Press P to resume');
    } else if (screen === SCREEN_WIN) {
      WIN_LINES[0] = finalLabel(state.score);
      WIN_LINES[1] = `Pipes fixed ${state.fixedCount} of ${state.burstCount}  ·  Flood ${Math.round(state.flood)}%`;
      WIN_LINES[2] = bestLabel(best);
      drawPanel('Shift saved!', WIN_LINES, 'Press Space or click to play again');
    } else if (screen === SCREEN_OVER) {
      OVER_LINES[0] = state.overReason === 'flood' ? 'The building flooded.' : 'Out of time, pipes still burst.';
      OVER_LINES[1] = finalLabel(state.score);
      OVER_LINES[2] = bestLabel(best);
      drawPanel('Shift failed', OVER_LINES, 'Press Space or click to try again');
    }
  }

  resize();
  window.addEventListener('resize', resize);
  return { draw };
}
