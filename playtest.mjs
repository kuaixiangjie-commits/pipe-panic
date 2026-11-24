// Headless autopilot for Pipe Panic! — verifies a WIN (all 6 pipes fixed) and a
// LOSE (the building floods with no input) under the real rules, with zero
// console errors and zero non-localhost requests. Exit 0 only if all of that
// holds. Usage: node playtest.mjs
import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "/tmp/pwtest/node_modules/playwright-core/index.mjs";

const ROOT = dirname(fileURLToPath(import.meta.url));
const URL = "http://localhost:8080/game/index.html";
const CHROME = "/home/hatch/.cache/ms-playwright/chromium-1187/chrome-linux/chrome";

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// Breadth-first search over walkable tiles; returns tile centres from the
// player's tile to the target tile, or null when unreachable.
function bfs(grid, player, target, tile) {
  const rows = grid.length;
  const cols = grid[0].length;
  const sx = Math.floor(player.x / tile);
  const sy = Math.floor(player.y / tile);
  const tx = Math.floor(target.x / tile);
  const ty = Math.floor(target.y / tile);
  const key = (x, y) => y * cols + x;
  const prev = new Map();
  const queue = [[sx, sy]];
  prev.set(key(sx, sy), null);
  while (queue.length > 0) {
    const [x, y] = queue.shift();
    if (x === tx && y === ty) break;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = x + dx;
      const ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= cols || ny >= rows) continue;
      if (grid[ny][nx] !== 0) continue;
      const k = key(nx, ny);
      if (prev.has(k)) continue;
      prev.set(k, [x, y]);
      queue.push([nx, ny]);
    }
  }
  if (!prev.has(key(tx, ty))) return null;
  const path = [];
  let cur = [tx, ty];
  while (cur) {
    path.unshift({ x: cur[0] * tile + tile / 2, y: cur[1] * tile + tile / 2 });
    cur = prev.get(key(cur[0], cur[1]));
  }
  return path;
}

async function autopilotWin(page) {
  await page.goto(URL, { waitUntil: "load" });
  await page.waitForFunction(() => window.__pp, null, { timeout: 10000 });
  await page.keyboard.press("Space");
  await page.waitForFunction(() => window.__pp.snapshot().screen === "playing", null, { timeout: 5000 });
  const held = new Set();
  const setKeys = async (want) => {
    for (const k of [...held]) {
      if (!want.has(k)) {
        await page.keyboard.up(k);
        held.delete(k);
      }
    }
    for (const k of [...want]) {
      if (!held.has(k)) {
        await page.keyboard.down(k);
        held.add(k);
      }
    }
  };
  const start = Date.now();
  while (Date.now() - start < 175000) {
    const snap = await page.evaluate(() => window.__pp.snapshot());
    if (snap.screen === "win") {
      await setKeys(new Set());
      return { ok: true, score: snap.score, timeLeft: snap.timeLeft, ms: Date.now() - start };
    }
    if (snap.screen === "lose") {
      await setKeys(new Set());
      return { ok: false, reason: `lost (${snap.result})`, snap };
    }
    const burst = snap.pipes.filter((p) => p.burst);
    if (burst.length === 0) {
      await sleep(150);
      continue;
    }
    let target = burst[0];
    let td = Infinity;
    for (const p of burst) {
      const d = (p.x - snap.player.x) ** 2 + (p.y - snap.player.y) ** 2;
      if (d < td) {
        td = d;
        target = p;
      }
    }
    if (Math.sqrt(td) < 55) {
      await setKeys(new Set(["KeyE"])); // in repair range: hold E, stand still
    } else {
      const path = bfs(snap.grid, snap.player, target, snap.tile);
      const want = new Set();
      const step = path && path.length > 1 ? path[1] : path && path[0];
      if (step) {
        const dx = step.x - snap.player.x;
        const dy = step.y - snap.player.y;
        if (dx > 8) want.add("KeyD");
        else if (dx < -8) want.add("KeyA");
        if (dy > 8) want.add("KeyS");
        else if (dy < -8) want.add("KeyW");
      }
      await setKeys(want);
    }
    await sleep(150);
  }
  await setKeys(new Set());
  return { ok: false, reason: "timeout: no win in 175 s" };
}

async function idleLose(page) {
  await page.goto(URL, { waitUntil: "load" });
  await page.waitForFunction(() => window.__pp, null, { timeout: 10000 });
  await page.keyboard.press("Space");
  await page.waitForFunction(() => window.__pp.snapshot().screen === "playing", null, { timeout: 5000 });
  const start = Date.now();
  while (Date.now() - start < 175000) {
    const snap = await page.evaluate(() => window.__pp.snapshot());
    if (snap.screen === "lose") {
      return { ok: true, result: snap.result, coverage: snap.coverage, ms: Date.now() - start };
    }
    if (snap.screen === "win") return { ok: false, reason: "idle player won (impossible)" };
    await sleep(1000);
  }
  return { ok: false, reason: "timeout: no lose in 175 s" };
}

async function main() {
  const server = spawn("node", ["serve.ts"], { cwd: ROOT, stdio: "pipe" });
  try {
    let up = false;
    for (let i = 0; i < 50; i++) {
      try {
        const r = await fetch(URL);
        if (r.ok) {
          up = true;
          break;
        }
      } catch {
        // server not up yet
      }
      await sleep(200);
    }
    if (!up) {
      console.log("PLAYTEST FAIL: dev server did not come up");
      process.exitCode = 1;
      return;
    }
    const launchOpts = { args: ["--no-sandbox", "--disable-dev-shm-usage"] };
    if (existsSync(CHROME)) launchOpts.executablePath = CHROME;
    const browser = await chromium.launch(launchOpts);
    try {
      const trackers = [];
      const makePage = async () => {
        const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
        const t = { errors: [], failed: [], nonLocal: [] };
        page.on("console", (m) => {
          if (m.type() === "error") t.errors.push(m.text());
        });
        page.on("pageerror", (e) => t.errors.push("pageerror: " + e.message));
        page.on("requestfailed", (r) => t.failed.push(r.url()));
        page.on("request", (r) => {
          const u = r.url();
          if (!u.startsWith("http://localhost:8080") && !u.startsWith("data:")) t.nonLocal.push(u);
        });
        trackers.push(t);
        return page;
      };
      const [winPage, losePage] = await Promise.all([makePage(), makePage()]);
      const [win, lose] = await Promise.all([autopilotWin(winPage), idleLose(losePage)]);
      const errors = trackers.flatMap((t) => t.errors);
      const failed = trackers.flatMap((t) => t.failed);
      const nonLocal = trackers.flatMap((t) => t.nonLocal);
      console.log("WIN :", win.ok ? `PASS score=${win.score} timeLeft=${win.timeLeft}s in ${(win.ms / 1000).toFixed(1)}s` : `FAIL ${win.reason}`);
      console.log("LOSE:", lose.ok ? `PASS result=${lose.result} coverage=${lose.coverage} in ${(lose.ms / 1000).toFixed(1)}s` : `FAIL ${lose.reason}`);
      console.log("CONSOLE ERRORS:", errors.length, JSON.stringify(errors));
      console.log("FAILED REQUESTS:", failed.length, JSON.stringify(failed));
      console.log("NON-LOCALHOST REQUESTS:", nonLocal.length, JSON.stringify(nonLocal));
      const pass = win.ok && lose.ok && errors.length === 0 && failed.length === 0 && nonLocal.length === 0;
      console.log(pass ? "PLAYTEST PASS" : "PLAYTEST FAIL");
      process.exitCode = pass ? 0 : 1;
    } finally {
      await browser.close();
    }
  } finally {
    server.kill();
  }
}

main();
