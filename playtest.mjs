// Pipe Panic! — headless playtest.
// Starts the local server, opens the game in a headless browser, and plays
// it with the real rules: an autopilot steers the plumber with real key
// events (BFS over the tile grid), a second game is left idle to verify the
// lose path. Exits 0 only when WIN (6/6 pipes) and LOSE are both verified
// with zero console errors, zero failed requests, and zero non-localhost
// requests.
import { spawn } from "node:child_process";
import { readdirSync } from "node:fs";
import { chromium } from "playwright-core";

const ROOT = new URL(".", import.meta.url).pathname;
const BASE = "http://localhost:8080";
const errors = [];
const external = [];
const failedReqs = [];

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function waitForServer(timeoutMs = 15000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const res = await fetch(`${BASE}/game/index.html`);
      if (res.ok) return true;
    } catch {
      // Not up yet.
    }
    await sleep(250);
  }
  throw new Error("server did not come up");
}

function trackPage(page, label) {
  page.on("console", (msg) => {
    if (msg.type() === "error") errors.push(`[${label}] console: ${msg.text()}`);
  });
  page.on("pageerror", (err) => errors.push(`[${label}] pageerror: ${String(err)}`));
  page.on("requestfailed", (req) => {
    failedReqs.push(`[${label}] ${req.url()} :: ${req.failure()?.errorText}`);
  });
  page.on("request", (req) => {
    const u = req.url();
    if (!u.startsWith(BASE) && !u.startsWith("data:") && u !== "about:blank") {
      external.push(`[${label}] ${u}`);
    }
  });
}

// BFS over the tile grid (0 = floor). Returns waypoints in map coordinates.
function bfs(grid, sx, sy, tx, ty) {
  const rows = grid.length;
  const cols = grid[0].length;
  const key = (x, y) => y * cols + x;
  const prev = new Map();
  const q = [[sx, sy]];
  prev.set(key(sx, sy), null);
  const dirs = [
    [1, 0],
    [-1, 0],
    [0, 1],
    [0, -1],
  ];
  while (q.length) {
    const [x, y] = q.shift();
    if (x === tx && y === ty) break;
    for (const [dx, dy] of dirs) {
      const nx = x + dx;
      const ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= cols || ny >= rows) continue;
      if (grid[ny][nx] !== 0) continue;
      const k = key(nx, ny);
      if (prev.has(k)) continue;
      prev.set(k, key(x, y));
      q.push([nx, ny]);
    }
  }
  if (!prev.has(key(tx, ty))) return null;
  const path = [];
  let cur = key(tx, ty);
  while (cur !== null) {
    path.push([cur % cols, Math.floor(cur / cols)]);
    cur = prev.get(cur);
  }
  path.reverse();
  return path.map(([x, y]) => ({ x: x * 40 + 20, y: y * 40 + 20 }));
}

async function launchBrowser() {
  try {
    return await chromium.launch({ headless: true });
  } catch {
    const base = `${process.env.HOME}/.cache/ms-playwright`;
    const dirs = readdirSync(base).filter((d) => d.startsWith("chromium-") && !d.includes("headless"));
    const exe = `${base}/${dirs[0]}/chrome-linux/chrome`;
    return chromium.launch({ headless: true, executablePath: exe });
  }
}

async function runWin(page) {
  await page.goto(`${BASE}/game/index.html`, { waitUntil: "load" });
  await page.waitForFunction(() => window.__pp && window.__pp.world, null, { timeout: 10000 });
  await page.keyboard.press("Space");
  // Make sure the game actually started; nudge again if it did not.
  for (let i = 0; i < 6; i++) {
    const s = await page.evaluate(() => window.__pp.snapshot());
    if (s.screen === "playing") break;
    await page.mouse.click(700, 500);
    await page.keyboard.press("Space");
    await sleep(400);
  }
  const grid = await page.evaluate(() => window.__pp.world.grid);
  const down = new Set();
  async function setKeys(want) {
    for (const k of ["KeyW", "KeyA", "KeyS", "KeyD", "KeyE"]) {
      if (want.has(k) && !down.has(k)) {
        await page.keyboard.down(k);
        down.add(k);
      } else if (!want.has(k) && down.has(k)) {
        await page.keyboard.up(k);
        down.delete(k);
      }
    }
  }
  const t0 = Date.now();
  let lastMove = Date.now();
  let lastPos = null;
  while (Date.now() - t0 < 240000) {
    const s = await page.evaluate(() => window.__pp.snapshot());
    if (s.screen === "win") {
      await setKeys(new Set());
      return { ok: true, seconds: Math.round((Date.now() - t0) / 1000), score: s.score, pipesFixed: s.pipesFixed };
    }
    if (s.screen === "lose") {
      await setKeys(new Set());
      return {
        ok: false,
        reason: `lost (${s.reason}) at ${Math.round((Date.now() - t0) / 1000)}s, pipes ${s.pipesFixed}/6, coverage ${Math.round(s.coverage * 100)}%`,
      };
    }
    let target = null;
    let best = Infinity;
    for (const p of s.pipes) {
      if (!p.burst) continue;
      const d = Math.hypot(p.x - s.player.x, p.y - s.player.y);
      if (d < best) {
        best = d;
        target = p;
      }
    }
    if (!target) {
      await sleep(150);
      continue;
    }
    const want = new Set();
    if (best < 58) {
      want.add("KeyE");
    } else {
      const px = Math.floor(s.player.x / 40);
      const py = Math.floor(s.player.y / 40);
      const path = bfs(grid, px, py, target.tx, target.ty);
      const wp = path && path.length > 1 ? path[1] : { x: target.x, y: target.y };
      const dx = wp.x - s.player.x;
      const dy = wp.y - s.player.y;
      if (dx > 6) want.add("KeyD");
      else if (dx < -6) want.add("KeyA");
      if (dy > 6) want.add("KeyS");
      else if (dy < -6) want.add("KeyW");
    }
    await setKeys(want);
    const moved = lastPos ? Math.hypot(s.player.x - lastPos.x, s.player.y - lastPos.y) : 99;
    if (moved > 4) lastMove = Date.now();
    lastPos = { x: s.player.x, y: s.player.y };
    if (Date.now() - lastMove > 2500) {
      // Stuck against a wall: nudge upward briefly, then carry on.
      await setKeys(new Set(["KeyW"]));
      await sleep(400);
      await setKeys(new Set());
      lastMove = Date.now();
    }
    await sleep(120);
  }
  await setKeys(new Set());
  return { ok: false, reason: "timeout (no win in 240s)" };
}

async function runLose(page) {
  await page.goto(`${BASE}/game/index.html`, { waitUntil: "load" });
  await page.waitForFunction(() => window.__pp && window.__pp.world, null, { timeout: 10000 });
  await page.keyboard.press("Space");
  const t0 = Date.now();
  while (Date.now() - t0 < 210000) {
    const s = await page.evaluate(() => window.__pp.snapshot());
    if (s.screen === "lose") {
      return {
        ok: true,
        reason: s.reason,
        seconds: Math.round((Date.now() - t0) / 1000),
        pipesFixed: s.pipesFixed,
        coverage: Math.round(s.coverage * 100),
      };
    }
    if (s.screen === "win") return { ok: false, reason: "unexpected win with no input" };
    await sleep(1000);
  }
  return { ok: false, reason: "timeout (no lose in 210s)" };
}

async function main() {
  const server = spawn("node", ["serve.ts"], { cwd: ROOT, stdio: "ignore" });
  let browser = null;
  try {
    await waitForServer();
    browser = await launchBrowser();
    const ctx = await browser.newContext({ viewport: { width: 1400, height: 1000 } });
    const winPage = await ctx.newPage();
    const losePage = await ctx.newPage();
    trackPage(winPage, "win");
    trackPage(losePage, "lose");
    const [win, lose] = await Promise.all([runWin(winPage), runLose(losePage)]);
    console.log("WIN:", JSON.stringify(win));
    console.log("LOSE:", JSON.stringify(lose));
    console.log("CONSOLE ERRORS:", errors.length ? errors.join(" | ") : "none");
    console.log("FAILED REQUESTS:", failedReqs.length ? failedReqs.join(" | ") : "none");
    console.log("NON-LOCALHOST REQUESTS:", external.length ? external.join(" | ") : "none");
    const pass = win.ok && lose.ok && errors.length === 0 && failedReqs.length === 0 && external.length === 0;
    console.log(pass ? "PLAYTEST PASS" : "PLAYTEST FAIL");
    process.exitCode = pass ? 0 : 1;
  } finally {
    if (browser) await browser.close().catch(() => {});
    server.kill();
  }
}

main().catch((e) => {
  console.error("PLAYTEST ERROR", e);
  process.exit(1);
});
