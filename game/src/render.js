// Pipe Panic! — all drawing: map, water, pipes, pickups, the plumber, HUD,
// minimap, and the title / pause / win / lose screens. Canvas art only.
import { COLS, HUD_H, MAP_H, MAP_W, ROWS, TILE } from "./config.js";
import { ROOMS } from "./map.js";

const TIER_COLORS = {
  CALM: "#58c472",
  BUSY: "#e8c832",
  RUSH: "#ef8f2e",
  FLOODING: "#e5484d",
};

export class Renderer {
  constructor(canvas) {
    this.canvas = canvas;
    this.canvas.width = MAP_W;
    this.canvas.height = HUD_H + MAP_H;
    this.ctx = canvas.getContext("2d");
  }

  draw(world) {
    const ctx = this.ctx;
    ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    this.drawHUD(world);
    ctx.save();
    ctx.translate(0, HUD_H);
    this.drawMap(world);
    ctx.restore();
    this.drawMinimap(world);
    if (world.screen === "title") this.drawTitle(world);
    else if (world.screen === "paused") this.drawPaused(world);
    else if (world.screen === "win") this.drawWin(world);
    else if (world.screen === "lose") this.drawLose(world);
  }

  // ---- HUD (top bar, canvas coordinates) ----
  drawHUD(world) {
    const ctx = this.ctx;
    ctx.fillStyle = "#20242e";
    ctx.fillRect(0, 0, MAP_W, HUD_H);
    ctx.fillStyle = "#343a48";
    ctx.fillRect(0, HUD_H - 2, MAP_W, 2);

    ctx.textAlign = "left";
    ctx.textBaseline = "alphabetic";
    ctx.fillStyle = "#ffffff";
    ctx.font = "bold 22px system-ui, sans-serif";
    ctx.fillText("PIPE PANIC!", 16, 28);
    ctx.fillStyle = "#9aa3b2";
    ctx.font = "11px system-ui, sans-serif";
    ctx.fillText("Copperton · Harborview Apartments", 16, 48);

    const label = (text, x) => {
      ctx.fillStyle = "#9aa3b2";
      ctx.font = "11px system-ui, sans-serif";
      ctx.fillText(text, x, 22);
    };
    const value = (text, x, color = "#ffffff") => {
      ctx.fillStyle = color;
      ctx.font = "bold 22px system-ui, sans-serif";
      ctx.fillText(text, x, 50);
    };

    label("SCORE", 420);
    value(String(world.score), 420);
    label("TIME", 620);
    const mm = Math.floor(world.timeLeft / 60);
    const ss = Math.floor(world.timeLeft % 60);
    const timeText = `${mm}:${String(ss).padStart(2, "0")}`;
    value(timeText, 620, world.timeLeft <= 30 ? "#ff6b5e" : "#ffffff");
    label("PIPES", 780);
    value(`${world.pipesFixed} / 6`, 780);

    // Pressure gauge.
    label("PRESSURE", 930);
    ctx.fillStyle = "#11141c";
    ctx.fillRect(930, 30, 180, 16);
    const pColor = TIER_COLORS[world.pressureTier] || "#58c472";
    ctx.fillStyle = pColor;
    ctx.fillRect(930, 30, Math.max(0, Math.min(180, (world.pressure / 100) * 180)), 16);
    ctx.fillStyle = pColor;
    ctx.font = "bold 14px system-ui, sans-serif";
    ctx.fillText(world.pressureTier, 1120, 44);

    // Water coverage.
    label("WATER", 1240);
    ctx.fillStyle = "#11141c";
    ctx.fillRect(1240, 30, 120, 16);
    ctx.fillStyle = "#3f78dc";
    ctx.fillRect(1240, 30, Math.max(0, Math.min(120, world.coverage() * 120)), 16);
    ctx.fillStyle = "#ffffff";
    ctx.font = "bold 14px system-ui, sans-serif";
    ctx.fillText(`${Math.round(world.coverage() * 100)}%`, 1370, 44);

    // Active pickup timers.
    ctx.font = "bold 12px system-ui, sans-serif";
    let py = 26;
    if (world.wrenchTime > 0) {
      ctx.fillStyle = "#ffd23f";
      ctx.fillText(`WRENCH ${Math.ceil(world.wrenchTime)}s`, 1460, py);
      py += 20;
    }
    if (world.coffeeTime > 0) {
      ctx.fillStyle = "#ff9f43";
      ctx.fillText(`COFFEE ${Math.ceil(world.coffeeTime)}s`, 1460, py);
    }
  }

  // ---- Map (map coordinates, translated by HUD_H) ----
  drawMap(world) {
    const ctx = this.ctx;
    const t = world.time;

    // Room floors.
    for (const r of ROOMS) {
      ctx.fillStyle = r.color;
      ctx.fillRect(r.x0 * TILE, r.y0 * TILE, (r.x1 - r.x0 + 1) * TILE, (r.y1 - r.y0 + 1) * TILE);
    }
    // Subtle tile grid.
    ctx.strokeStyle = "rgba(0,0,0,0.05)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let x = 0; x <= COLS; x++) {
      ctx.moveTo(x * TILE + 0.5, 0);
      ctx.lineTo(x * TILE + 0.5, MAP_H);
    }
    for (let y = 0; y <= ROWS; y++) {
      ctx.moveTo(0, y * TILE + 0.5);
      ctx.lineTo(MAP_W, y * TILE + 0.5);
    }
    ctx.stroke();
    // Room names (not the hallway — the pipe lives at its center).
    ctx.fillStyle = "rgba(0,0,0,0.30)";
    ctx.font = "15px system-ui, sans-serif";
    ctx.textAlign = "center";
    for (let i = 0; i < ROOMS.length; i++) {
      if (i === 3) continue;
      const r = ROOMS[i];
      const cx = ((r.x0 + r.x1 + 1) / 2) * TILE;
      const cy = ((r.y0 + r.y1 + 1) / 2) * TILE;
      ctx.fillText(r.name, cx, cy);
    }
    ctx.textAlign = "left";

    // Standing water.
    for (let ty = 0; ty < ROWS; ty++) {
      for (let tx = 0; tx < COLS; tx++) {
        const w = world.water[ty * COLS + tx];
        if (w <= 0.05) continue;
        ctx.fillStyle = `rgba(52,120,220,${0.16 + 0.42 * w})`;
        ctx.fillRect(tx * TILE + 1, ty * TILE + 1, TILE - 2, TILE - 2);
      }
    }

    // Furniture and walls.
    for (let ty = 0; ty < ROWS; ty++) {
      for (let tx = 0; tx < COLS; tx++) {
        const k = world.grid[ty][tx];
        if (k === 2) {
          ctx.fillStyle = "#8a6a48";
          ctx.fillRect(tx * TILE + 2, ty * TILE + 2, TILE - 4, TILE - 4);
          ctx.strokeStyle = "#6b4f33";
          ctx.lineWidth = 2;
          ctx.strokeRect(tx * TILE + 2, ty * TILE + 2, TILE - 4, TILE - 4);
        } else if (k === 1) {
          ctx.fillStyle = "#39404d";
          ctx.fillRect(tx * TILE, ty * TILE, TILE, TILE);
          ctx.fillStyle = "#4d5666";
          ctx.fillRect(tx * TILE, ty * TILE, TILE, 3);
        }
      }
    }

    this.drawPipes(world, t);
    this.drawPickups(world, t);
    this.drawPlayer(world, t);
  }

  drawPipes(world, t) {
    const ctx = this.ctx;
    for (const p of world.pipes) {
      // Steel pipe body.
      ctx.fillStyle = "#8f9aa6";
      ctx.beginPath();
      ctx.roundRect(p.x - 18, p.y - 5, 36, 10, 5);
      ctx.fill();
      ctx.fillStyle = "#6e7883";
      ctx.fillRect(p.x - 18, p.y + 2, 36, 3);
      // Valve wheel on top.
      ctx.strokeStyle = "#c0392b";
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(p.x, p.y - 12, 7, 0, Math.PI * 2);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(p.x - 7, p.y - 12);
      ctx.lineTo(p.x + 7, p.y - 12);
      ctx.moveTo(p.x, p.y - 19);
      ctx.lineTo(p.x, p.y - 5);
      ctx.stroke();

      if (p.burst) {
        // Spraying water: droplets flying out on a loop.
        ctx.fillStyle = "rgba(120,180,255,0.9)";
        for (let i = 0; i < 9; i++) {
          const a = (i / 9) * Math.PI * 2 + t * 0.6;
          const r = 12 + ((t * 70 + i * 31) % 42);
          const dx = Math.cos(a) * r;
          const dy = Math.sin(a) * r * 0.7 - 6;
          ctx.beginPath();
          ctx.arc(p.x + dx, p.y + dy, 2.4, 0, Math.PI * 2);
          ctx.fill();
        }
        // Pulsing red alarm ring.
        const pulse = 26 + 3 * Math.sin(t * 6);
        ctx.strokeStyle = `rgba(229,72,77,${0.45 + 0.3 * Math.sin(t * 6)})`;
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(p.x, p.y, pulse, 0, Math.PI * 2);
        ctx.stroke();
        // Repair progress ring while the plumber works on it.
        if (world.repairTarget === p && p.progress > 0) {
          ctx.strokeStyle = "#ffd23f";
          ctx.lineWidth = 4;
          ctx.beginPath();
          ctx.arc(p.x, p.y, 30, -Math.PI / 2, -Math.PI / 2 + p.progress * Math.PI * 2);
          ctx.stroke();
        }
      } else {
        // Fixed: green check mark.
        ctx.strokeStyle = "#2fae5f";
        ctx.lineWidth = 4;
        ctx.lineCap = "round";
        ctx.beginPath();
        ctx.moveTo(p.x - 8, p.y - 2);
        ctx.lineTo(p.x - 2, p.y + 5);
        ctx.lineTo(p.x + 9, p.y - 7);
        ctx.stroke();
        ctx.lineCap = "butt";
      }
    }
  }

  drawPickups(world, t) {
    const ctx = this.ctx;
    for (const pk of world.pickups) {
      if (pk.taken) continue;
      const bob = Math.sin(t * 3 + pk.x) * 2;
      const x = pk.x;
      const y = pk.y + bob;
      if (pk.kind === "wrench") {
        ctx.save();
        ctx.translate(x, y);
        ctx.rotate(-0.6);
        ctx.strokeStyle = "#c8ccd2";
        ctx.lineWidth = 5;
        ctx.lineCap = "round";
        ctx.beginPath();
        ctx.moveTo(-10, 8);
        ctx.lineTo(8, -8);
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(11, -11, 6, 0.6, Math.PI * 2 - 0.6);
        ctx.stroke();
        ctx.restore();
      } else if (pk.kind === "coffee") {
        ctx.fillStyle = "#ffffff";
        ctx.beginPath();
        ctx.roundRect(x - 8, y - 6, 16, 16, 3);
        ctx.fill();
        ctx.fillStyle = "#7a4a21";
        ctx.beginPath();
        ctx.ellipse(x, y - 5, 7, 2.5, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = "rgba(255,255,255,0.7)";
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(x - 3, y - 10);
        ctx.quadraticCurveTo(x - 5, y - 15, x - 3, y - 19);
        ctx.moveTo(x + 3, y - 10);
        ctx.quadraticCurveTo(x + 5, y - 15, x + 3, y - 19);
        ctx.stroke();
      } else {
        // Rubber duck.
        ctx.fillStyle = "#ffd23f";
        ctx.beginPath();
        ctx.arc(x, y + 2, 9, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.arc(x + 4, y - 6, 6, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = "#ff8c1a";
        ctx.beginPath();
        ctx.moveTo(x + 9, y - 7);
        ctx.lineTo(x + 15, y - 4);
        ctx.lineTo(x + 9, y - 2);
        ctx.closePath();
        ctx.fill();
        ctx.fillStyle = "#222";
        ctx.beginPath();
        ctx.arc(x + 5, y - 8, 1.4, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }

  drawPlayer(world, t) {
    const ctx = this.ctx;
    const p = world.player;
    const bob = p.moving ? Math.sin(t * 12) * 1.5 : 0;
    const x = p.x;
    const y = p.y + bob;

    // Shadow.
    ctx.fillStyle = "rgba(0,0,0,0.25)";
    ctx.beginPath();
    ctx.ellipse(p.x, p.y + 13, 13, 5, 0, 0, Math.PI * 2);
    ctx.fill();

    // Overalls body.
    ctx.fillStyle = "#2f6fb2";
    ctx.beginPath();
    ctx.arc(x, y, 14, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#245a94";
    ctx.fillRect(x - 6, y - 2, 12, 10);
    // Head.
    ctx.fillStyle = "#f0c8a0";
    ctx.beginPath();
    ctx.arc(x, y - 11, 8, 0, Math.PI * 2);
    ctx.fill();
    // Red cap.
    ctx.fillStyle = "#d93a2b";
    ctx.beginPath();
    ctx.arc(x, y - 12, 8, Math.PI, 0);
    ctx.fill();
    ctx.fillRect(x + (p.face > 0 ? 0 : -10), y - 14, 10, 3);
    // Wrench in hand while repairing.
    if (world.repairTarget) {
      ctx.strokeStyle = "#c8ccd2";
      ctx.lineWidth = 4;
      ctx.lineCap = "round";
      ctx.beginPath();
      ctx.moveTo(x + p.face * 12, y + 2);
      ctx.lineTo(x + p.face * 22, y - 8);
      ctx.stroke();
      ctx.lineCap = "butt";
    }
    // Mop while mopping.
    if (world.mopping) {
      ctx.strokeStyle = "#8a6a48";
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(x + p.face * 10, y + 4);
      ctx.lineTo(x + p.face * 24, y + 12);
      ctx.stroke();
      ctx.fillStyle = "#e8e0c8";
      ctx.beginPath();
      ctx.arc(x + p.face * 26, y + 13, 5, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // ---- Minimap (bottom-right, canvas coordinates) ----
  drawMinimap(world) {
    const ctx = this.ctx;
    const x0 = MAP_W - 216;
    const y0 = HUD_H + MAP_H - 166;
    const sx = 200 / MAP_W;
    const sy = 150 / MAP_H;
    ctx.fillStyle = "rgba(8,12,20,0.72)";
    ctx.fillRect(x0, y0, 200, 150);
    ctx.strokeStyle = "rgba(255,255,255,0.25)";
    ctx.lineWidth = 1;
    ctx.strokeRect(x0, y0, 200, 150);

    for (const r of ROOMS) {
      ctx.fillStyle = r.color;
      ctx.globalAlpha = 0.85;
      ctx.fillRect(x0 + r.x0 * TILE * sx, y0 + r.y0 * TILE * sy, (r.x1 - r.x0 + 1) * TILE * sx, (r.y1 - r.y0 + 1) * TILE * sy);
    }
    ctx.globalAlpha = 1;
    ctx.fillStyle = "rgba(63,120,220,0.9)";
    for (let ty = 0; ty < ROWS; ty++) {
      for (let tx = 0; tx < COLS; tx++) {
        if (world.water[ty * COLS + tx] > 0.3) {
          ctx.fillRect(x0 + tx * TILE * sx, y0 + ty * TILE * sy, 5, 5);
        }
      }
    }
    for (const pk of world.pickups) {
      if (pk.taken) continue;
      ctx.fillStyle = "#ffd23f";
      ctx.fillRect(x0 + pk.x * sx - 2, y0 + pk.y * sy - 2, 4, 4);
    }
    for (const p of world.pipes) {
      ctx.fillStyle = p.burst ? "#e5484d" : "#2fae5f";
      ctx.beginPath();
      ctx.arc(x0 + p.x * sx, y0 + p.y * sy, 3.5, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.fillStyle = "#ffffff";
    ctx.strokeStyle = "#222";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(x0 + world.player.x * sx, y0 + world.player.y * sy, 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = "rgba(255,255,255,0.7)";
    ctx.font = "10px system-ui, sans-serif";
    ctx.fillText("MAP", x0 + 6, y0 + 12);
  }

  // ---- Screens ----
  overlay(title, lines, hint, titleColor = "#ffffff") {
    const ctx = this.ctx;
    ctx.fillStyle = "rgba(6,8,14,0.66)";
    ctx.fillRect(0, 0, MAP_W, HUD_H + MAP_H);
    const w = 780;
    const h = 170 + lines.length * 30;
    const x = (MAP_W - w) / 2;
    const y = (HUD_H + MAP_H - h) / 2;
    ctx.fillStyle = "#1b2130";
    ctx.beginPath();
    ctx.roundRect(x, y, w, h, 14);
    ctx.fill();
    ctx.strokeStyle = "#3a4358";
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.textAlign = "center";
    ctx.fillStyle = titleColor;
    ctx.font = "bold 44px system-ui, sans-serif";
    ctx.fillText(title, MAP_W / 2, y + 70);
    ctx.fillStyle = "#dfe3ea";
    ctx.font = "18px system-ui, sans-serif";
    lines.forEach((line, i) => {
      ctx.fillText(line, MAP_W / 2, y + 116 + i * 30);
    });
    ctx.fillStyle = "#9aa3b2";
    ctx.font = "15px system-ui, sans-serif";
    ctx.fillText(hint, MAP_W / 2, y + h - 24);
    ctx.textAlign = "left";
  }

  drawTitle(world) {
    this.overlay(
      "PIPE PANIC!",
      [
        "One rainy night in Copperton, every pipe in Harborview Apartments burst at once.",
        "You are Pip Calloway, the plumber on call.",
        "",
        "Move — WASD or arrow keys · Hold E to repair a pipe or mop up water · P to pause",
        "Fix all 6 pipes in 3:00. If the water covers 75% of the floor, the building floods.",
      ],
      "Press Space or click to start",
    );
  }

  drawPaused(world) {
    this.overlay(
      "PAUSED",
      ["Take a breath. The water waits for no one — except right now."],
      "Press P or Esc to resume",
    );
  }

  drawWin(world) {
    this.overlay(
      "SHIFT COMPLETE!",
      [
        "All 6 pipes fixed — the building is dry again.",
        `Score: ${world.score}   (time bonus +${world.timeBonus})`,
        `Best: ${world.best}`,
      ],
      "Press Space or click to play again",
      "#58c472",
    );
  }

  drawLose(world) {
    const title = world.reason === "flood" ? "THE BUILDING FLOODED" : "TIME'S UP";
    this.overlay(
      title,
      [
        `Pipes fixed: ${world.pipesFixed} / 6`,
        `Score: ${world.score}`,
        `Best: ${world.best}`,
      ],
      "Press Space or click to try again",
      "#e5484d",
    );
  }
}
