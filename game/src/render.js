// Canvas rendering: hand-drawn shapes only, no images.
// Layout: a 64px HUD bar on top, the 1600x1200 map below it, minimap bottom-right.
import { COLS, ROWS, TILE, MAP_W, MAP_H, HUD_H, FLOOD_COVERAGE, tierName } from "./config.js";
import { ROOMS, roomAt } from "./map.js";

const FLOOR_TINTS = ["#2a2620", "#262a26", "#27262e", "#2b2723", "#262a2a", "#2a2626", "#28262b"];
const WALL_COLOR = "#4a4238";
const WALL_TOP = "#5d5347";

function fmtTime(seconds) {
  const s = Math.max(0, Math.ceil(seconds));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

export class Renderer {
  constructor(canvas) {
    this.canvas = canvas;
    this.canvas.width = MAP_W;
    this.canvas.height = MAP_H + HUD_H;
    this.ctx = canvas.getContext("2d");
    // Precompute which room each tile belongs to, for floor tints.
    this.roomGrid = [];
    for (let ty = 0; ty < ROWS; ty++) {
      const row = [];
      for (let tx = 0; tx < COLS; tx++) {
        const name = roomAt(tx, ty);
        row.push(name ? ROOMS.findIndex((r) => r.name === name) : -1);
      }
      this.roomGrid.push(row);
    }
  }

  draw(world, now) {
    const ctx = this.ctx;
    ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    this.drawHud(world);
    ctx.save();
    ctx.translate(0, HUD_H);
    this.drawMap(world, now);
    this.drawWater(world);
    this.drawPipes(world, now);
    this.drawPickups(world, now);
    this.drawPlayer(world);
    this.drawMinimap(world);
    ctx.restore();
    this.drawOverlay(world);
  }

  drawHud(world) {
    const ctx = this.ctx;
    ctx.fillStyle = "#191c24";
    ctx.fillRect(0, 0, MAP_W, HUD_H);
    ctx.fillStyle = "#2c3140";
    ctx.fillRect(0, HUD_H - 2, MAP_W, 2);
    ctx.fillStyle = "#e8e8e8";
    ctx.font = "bold 22px system-ui, sans-serif";
    ctx.textBaseline = "middle";
    ctx.textAlign = "left";
    ctx.fillText(`SCORE ${world.score}`, 18, HUD_H / 2);
    ctx.fillText(`TIME ${fmtTime(world.timeLeft)}`, 300, HUD_H / 2);
    const fixed = world.pipes.filter((p) => !p.burst).length;
    ctx.fillText(`PIPES ${fixed}/6`, 520, HUD_H / 2);
    // Pressure gauge.
    const gx = 700;
    const gw = 260;
    ctx.fillStyle = "#333";
    ctx.fillRect(gx, HUD_H / 2 - 10, gw, 20);
    const frac = Math.max(0, Math.min(1, world.pressure / 100));
    ctx.fillStyle = world.pressure >= 75 ? "#e5484d" : world.pressure >= 50 ? "#f5a524" : "#46a758";
    ctx.fillRect(gx, HUD_H / 2 - 10, gw * frac, 20);
    ctx.strokeStyle = "#666";
    ctx.strokeRect(gx, HUD_H / 2 - 10, gw, 20);
    ctx.fillStyle = "#e8e8e8";
    ctx.font = "bold 18px system-ui, sans-serif";
    ctx.fillText(`${tierName(world.pressure)} ${Math.round(world.pressure)}`, gx + gw + 12, HUD_H / 2);
    ctx.textAlign = "right";
    ctx.fillText(`WATER ${Math.round(world.coverage * 100)}%`, MAP_W - 18, HUD_H / 2);
    ctx.textAlign = "left";
    if (world.effects.wrench > 0) {
      ctx.fillStyle = "#f5c542";
      ctx.font = "bold 16px system-ui, sans-serif";
      ctx.fillText(`WRENCH ${Math.ceil(world.effects.wrench)}s`, 1080, HUD_H / 2);
    }
    if (world.effects.coffee > 0) {
      ctx.fillStyle = "#c98a4b";
      ctx.font = "bold 16px system-ui, sans-serif";
      ctx.fillText(`COFFEE ${Math.ceil(world.effects.coffee)}s`, 1220, HUD_H / 2);
    }
  }

  drawMap(world) {
    const ctx = this.ctx;
    for (let ty = 0; ty < ROWS; ty++) {
      for (let tx = 0; tx < COLS; tx++) {
        const v = world.grid[ty][tx];
        const x = tx * TILE;
        const y = ty * TILE;
        if (v === 0) {
          const ri = this.roomGrid[ty][tx];
          ctx.fillStyle = ri >= 0 ? FLOOR_TINTS[ri % FLOOR_TINTS.length] : "#26221c";
          ctx.fillRect(x, y, TILE, TILE);
          ctx.strokeStyle = "rgba(0,0,0,0.12)";
          ctx.strokeRect(x + 0.5, y + 0.5, TILE - 1, TILE - 1);
        } else if (v === 1) {
          ctx.fillStyle = WALL_COLOR;
          ctx.fillRect(x, y, TILE, TILE);
          ctx.fillStyle = WALL_TOP;
          ctx.fillRect(x, y, TILE, 6);
        } else {
          // Furniture: a wooden block with a lighter top.
          ctx.fillStyle = "#6b4f2a";
          ctx.fillRect(x + 3, y + 3, TILE - 6, TILE - 6);
          ctx.fillStyle = "#8a6a3b";
          ctx.fillRect(x + 3, y + 3, TILE - 6, 8);
        }
      }
    }
    // Room labels.
    ctx.fillStyle = "rgba(232,232,232,0.35)";
    ctx.font = "bold 20px system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    for (const r of ROOMS) {
      const cx = ((r.x0 + r.x1 + 1) / 2) * TILE;
      const cy = ((r.y0 + r.y1 + 1) / 2) * TILE;
      ctx.fillText(r.name, cx, cy);
    }
    ctx.textAlign = "left";
  }

  drawWater(world) {
    const ctx = this.ctx;
    for (let ty = 0; ty < ROWS; ty++) {
      for (let tx = 0; tx < COLS; tx++) {
        const w = world.water[ty * COLS + tx];
        if (w <= 0.02) continue;
        ctx.fillStyle = `rgba(48, 130, 220, ${0.15 + w * 0.5})`;
        ctx.fillRect(tx * TILE, ty * TILE, TILE, TILE);
      }
    }
  }

  drawPipes(world, now) {
    const ctx = this.ctx;
    const pulse = 0.6 + 0.4 * Math.sin(now / 180);
    for (const p of world.pipes) {
      if (p.burst) {
        ctx.fillStyle = `rgba(229, 72, 77, ${0.55 + 0.35 * pulse})`;
        ctx.beginPath();
        ctx.arc(p.x, p.y, 16, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = "#fff";
        ctx.font = "bold 20px system-ui, sans-serif";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText("!", p.x, p.y);
        // Spray: a few droplets around the burst.
        ctx.fillStyle = "rgba(120, 190, 255, 0.8)";
        for (let k = 0; k < 5; k++) {
          const a = (now / 240 + k * 1.256) % (Math.PI * 2);
          const r = 20 + ((now / 14 + k * 13) % 14);
          ctx.beginPath();
          ctx.arc(p.x + Math.cos(a) * r, p.y + Math.sin(a) * r, 3, 0, Math.PI * 2);
          ctx.fill();
        }
      } else {
        ctx.fillStyle = "#9aa3b2";
        ctx.beginPath();
        ctx.arc(p.x, p.y, 12, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = "#5c6675";
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.moveTo(p.x - 12, p.y);
        ctx.lineTo(p.x + 12, p.y);
        ctx.stroke();
        ctx.fillStyle = "#46a758";
        ctx.beginPath();
        ctx.arc(p.x, p.y - 16, 6, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    ctx.textAlign = "left";
  }

  drawPickups(world, now) {
    const ctx = this.ctx;
    const bob = Math.sin(now / 300) * 3;
    for (const pk of world.pickups) {
      if (pk.taken) continue;
      const y = pk.y + bob;
      if (pk.kind === "wrench") {
        ctx.strokeStyle = "#f5c542";
        ctx.lineWidth = 5;
        ctx.lineCap = "round";
        ctx.beginPath();
        ctx.moveTo(pk.x - 8, y + 10);
        ctx.lineTo(pk.x + 8, y - 10);
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(pk.x + 8, y - 10, 7, 0, Math.PI * 1.5);
        ctx.stroke();
      } else if (pk.kind === "coffee") {
        ctx.fillStyle = "#c98a4b";
        ctx.fillRect(pk.x - 8, y - 8, 16, 18);
        ctx.fillStyle = "#e8e8e8";
        ctx.fillRect(pk.x - 8, y - 8, 16, 5);
        ctx.strokeStyle = "rgba(232,232,232,0.7)";
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(pk.x - 4, y - 12);
        ctx.quadraticCurveTo(pk.x - 7, y - 18, pk.x - 3, y - 22);
        ctx.stroke();
      } else {
        // Rubber duck.
        ctx.fillStyle = "#ffd60a";
        ctx.beginPath();
        ctx.arc(pk.x, y + 2, 10, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.arc(pk.x + 4, y - 8, 6, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = "#f48c06";
        ctx.beginPath();
        ctx.moveTo(pk.x + 9, y - 9);
        ctx.lineTo(pk.x + 15, y - 6);
        ctx.lineTo(pk.x + 9, y - 4);
        ctx.closePath();
        ctx.fill();
        ctx.fillStyle = "#111";
        ctx.beginPath();
        ctx.arc(pk.x + 6, y - 10, 1.6, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }

  drawPlayer(world) {
    const ctx = this.ctx;
    const p = world.player;
    ctx.fillStyle = "rgba(0,0,0,0.35)";
    ctx.beginPath();
    ctx.ellipse(p.x, p.y + 12, 12, 5, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#3b82f6";
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "#1d4ed8";
    ctx.lineWidth = 3;
    ctx.stroke();
    // Plumber's cap.
    ctx.fillStyle = "#f5c542";
    ctx.beginPath();
    ctx.arc(p.x, p.y - 4, 9, Math.PI, 0);
    ctx.fill();
    ctx.fillRect(p.x - 9, p.y - 5, 18, 3);
    // Face.
    ctx.fillStyle = "#111";
    ctx.beginPath();
    ctx.arc(p.x - 5, p.y + 2, 1.8, 0, Math.PI * 2);
    ctx.arc(p.x + 5, p.y + 2, 1.8, 0, Math.PI * 2);
    ctx.fill();
  }

  drawMinimap(world) {
    const ctx = this.ctx;
    const mw = 200;
    const mh = 150;
    const mx = MAP_W - mw - 14;
    const my = MAP_H - mh - 14;
    const sx = mw / MAP_W;
    const sy = mh / MAP_H;
    ctx.fillStyle = "rgba(10, 12, 18, 0.85)";
    ctx.fillRect(mx, my, mw, mh);
    ctx.strokeStyle = "#555";
    ctx.strokeRect(mx, my, mw, mh);
    for (let ty = 0; ty < ROWS; ty++) {
      for (let tx = 0; tx < COLS; tx++) {
        if (world.grid[ty][tx] !== 0) continue;
        const w = world.water[ty * COLS + tx];
        if (w > 0.25) {
          ctx.fillStyle = "rgba(48,130,220,0.9)";
          ctx.fillRect(mx + tx * TILE * sx, my + ty * TILE * sy, TILE * sx + 1, TILE * sy + 1);
        }
      }
    }
    for (const p of world.pipes) {
      if (!p.burst) continue;
      ctx.fillStyle = "#e5484d";
      ctx.beginPath();
      ctx.arc(mx + p.x * sx, my + p.y * sy, 4, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.fillStyle = "#fff";
    ctx.beginPath();
    ctx.arc(mx + world.player.x * sx, my + world.player.y * sy, 4, 0, Math.PI * 2);
    ctx.fill();
  }

  drawOverlay(world) {
    const ctx = this.ctx;
    if (world.screen === "playing" || world.screen === "paused") {
      if (world.screen === "paused") {
        ctx.fillStyle = "rgba(10, 12, 18, 0.72)";
        ctx.fillRect(0, 0, MAP_W, MAP_H + HUD_H);
        ctx.fillStyle = "#e8e8e8";
        ctx.font = "bold 52px system-ui, sans-serif";
        ctx.textAlign = "center";
        ctx.fillText("PAUSED", MAP_W / 2, (MAP_H + HUD_H) / 2 - 20);
        ctx.font = "24px system-ui, sans-serif";
        ctx.fillText("Press P to resume", MAP_W / 2, (MAP_H + HUD_H) / 2 + 30);
        ctx.textAlign = "left";
      }
      return;
    }
    ctx.fillStyle = "rgba(10, 12, 18, 0.78)";
    ctx.fillRect(0, 0, MAP_W, MAP_H + HUD_H);
    ctx.textAlign = "center";
    ctx.fillStyle = "#e8e8e8";
    if (world.screen === "title") {
      ctx.font = "bold 84px system-ui, sans-serif";
      ctx.fillText("PIPE PANIC!", MAP_W / 2, 300);
      ctx.font = "26px system-ui, sans-serif";
      ctx.fillStyle = "#9aa3b2";
      ctx.fillText("One rainy night in Copperton, every pipe in Harborview Apartments burst at once.", MAP_W / 2, 370);
      ctx.fillStyle = "#e8e8e8";
      ctx.font = "24px system-ui, sans-serif";
      ctx.fillText("You are Pip Calloway, the plumber on call.", MAP_W / 2, 430);
      ctx.fillText("Move with WASD / arrow keys. Hold E to repair a burst pipe, or to mop up water.", MAP_W / 2, 480);
      ctx.fillText("P pauses. Fix all 6 pipes in 3:00 — if water covers 75% of the floor, the building floods.", MAP_W / 2, 520);
      ctx.fillText("Wrench: repair twice as fast. Coffee: move faster. Rubber ducks: +50 points.", MAP_W / 2, 560);
      ctx.font = "bold 30px system-ui, sans-serif";
      ctx.fillStyle = "#f5c542";
      ctx.fillText("Press SPACE to start", MAP_W / 2, 650);
      if (world.best > 0) {
        ctx.font = "22px system-ui, sans-serif";
        ctx.fillStyle = "#9aa3b2";
        ctx.fillText(`Best score: ${world.best}`, MAP_W / 2, 700);
      }
    } else if (world.screen === "win") {
      ctx.font = "bold 72px system-ui, sans-serif";
      ctx.fillStyle = "#46a758";
      ctx.fillText("SHIFT COMPLETE!", MAP_W / 2, 320);
      ctx.fillStyle = "#e8e8e8";
      ctx.font = "30px system-ui, sans-serif";
      ctx.fillText(`All 6 pipes fixed with ${fmtTime(world.timeLeft)} to spare.`, MAP_W / 2, 400);
      ctx.fillText(`Time bonus +${world.timeBonus}   ·   Score ${world.score}   ·   Best ${world.best}`, MAP_W / 2, 460);
      ctx.font = "bold 28px system-ui, sans-serif";
      ctx.fillStyle = "#f5c542";
      ctx.fillText("Press SPACE to play again", MAP_W / 2, 560);
    } else if (world.screen === "lose") {
      ctx.font = "bold 72px system-ui, sans-serif";
      ctx.fillStyle = "#e5484d";
      ctx.fillText(world.result === "flood" ? "THE BUILDING FLOODED!" : "OUT OF TIME!", MAP_W / 2, 320);
      ctx.fillStyle = "#e8e8e8";
      ctx.font = "30px system-ui, sans-serif";
      ctx.fillText(
        world.result === "flood"
          ? `Water covered ${Math.round(world.coverage * 100)}% of the floor.`
          : "The 3:00 shift ended with pipes still burst.",
        MAP_W / 2,
        400,
      );
      ctx.fillText(`Score ${world.score}   ·   Best ${world.best}`, MAP_W / 2, 460);
      ctx.font = "bold 28px system-ui, sans-serif";
      ctx.fillStyle = "#f5c542";
      ctx.fillText("Press SPACE to try again", MAP_W / 2, 560);
    }
    ctx.textAlign = "left";
  }
}
