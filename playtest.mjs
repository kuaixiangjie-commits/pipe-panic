// Pipe Panic! — headless autopilot playtest.
// Starts serve.ts, drives the game with real key events, and verifies a
// WIN (all 6 pipes fixed) and a LOSE (flood or timeout) are both reachable
// under the real rules, with zero console errors and zero non-localhost
// requests. Also captures the three staged screenshots.
import { spawn } from 'node:child_process';
import { statSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const { chromium } = require('/tmp/pwtest/node_modules/playwright-core');

const ROOT = dirname(fileURLToPath(import.meta.url));
const BASE = 'http://localhost:8080';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const errors = [];
const failedRequests = [];
const foreignRequests = [];
let shotSizes = {};

function track(page) {
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text());
  });
  page.on('pageerror', (e) => errors.push(String(e)));
  page.on('requestfailed', (r) => failedRequests.push(r.url()));
  page.on('request', (r) => {
    const u = r.url();
    if (!u.startsWith('http://localhost:8080') && !u.startsWith('data:') && !u.startsWith('blob:')) {
      foreignRequests.push(u);
    }
  });
}

async function waitServer(tries = 40) {
  for (let i = 0; i < tries; i++) {
    try {
      const res = await fetch(`${BASE}/game/index.html`);
      if (res.ok) return true;
    } catch (e) {
      // not up yet
    }
    await sleep(250);
  }
  return false;
}

let held = new Set();
async function setKeys(page, want) {
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
}

async function runWin(page) {
  await page.goto(`${BASE}/game/index.html`, { waitUntil: 'networkidle' });
  await page.waitForFunction(() => window.__pp, null, { timeout: 15000 });
  await page.keyboard.press('Space');
  await sleep(500);
  const t0 = Date.now();
  let lastPos = null;
  let stuckSince = null;
  while (Date.now() - t0 < 150000) {
    const s = await page.evaluate(() => window.__pp.state());
    if (s.screen === 'win') return { win: true, ...s, ms: Date.now() - t0 };
    if (s.screen === 'lose') return { win: false, ...s, ms: Date.now() - t0 };
    if (s.screen !== 'playing') {
      await sleep(200);
      continue;
    }
    const open = s.pipes.filter((p) => !p.fixed);
    if (open.length === 0) {
      await sleep(100);
      continue;
    }
    open.sort((a, b) => Math.hypot(a.x - s.px, a.y - s.py) - Math.hypot(b.x - s.px, b.y - s.py));
    // Take the nearest pipe that actually has a path; a pipe with no path
    // (unreachable tile) must be skipped, never retried forever.
    let pipe = null;
    let path = null;
    for (const cand of open) {
      const d = Math.hypot(cand.x - s.px, cand.y - s.py);
      if (d < 30) {
        pipe = cand;
        path = [];
        break;
      }
      const p = await page.evaluate(({ tx, ty }) => window.__pp.findPath(tx, ty), { tx: cand.tx, ty: cand.ty });
      if (p && p.length > 0) {
        pipe = cand;
        path = p;
        break;
      }
    }
    if (!pipe) {
      await sleep(150);
      continue;
    }
    const d = Math.hypot(pipe.x - s.px, pipe.y - s.py);
    if (d < 30) {
      await setKeys(page, new Set(['KeyE']));
      await sleep(120);
      continue;
    }
    const wp = path[0];
    const dx = wp.x - s.px;
    const dy = wp.y - s.py;
    const want = new Set();
    if (dx > 6) want.add('KeyD');
    else if (dx < -6) want.add('KeyA');
    if (dy > 6) want.add('KeyS');
    else if (dy < -6) want.add('KeyW');
    await setKeys(page, want);
    if (lastPos && Math.hypot(s.px - lastPos.x, s.py - lastPos.y) < 4) {
      if (!stuckSince) stuckSince = Date.now();
      if (Date.now() - stuckSince > 2500) {
        await setKeys(page, new Set(['KeyA']));
        await sleep(400);
        await setKeys(page, new Set());
        stuckSince = null;
      }
    } else {
      stuckSince = null;
    }
    lastPos = { x: s.px, y: s.py };
    await sleep(120);
  }
  return { win: false, timeout: true };
}

async function runLose(page) {
  await page.goto(`${BASE}/game/index.html`, { waitUntil: 'networkidle' });
  await page.waitForFunction(() => window.__pp, null, { timeout: 15000 });
  await page.keyboard.press('Space');
  await sleep(500);
  const t0 = Date.now();
  while (Date.now() - t0 < 200000) {
    const s = await page.evaluate(() => window.__pp.state());
    if (s.screen === 'lose') return { lose: true, ...s, ms: Date.now() - t0 };
    if (s.screen === 'win') return { lose: false, won: true, ...s };
    await sleep(1000);
  }
  return { lose: false, timeout: true };
}

async function capture(page, url, file) {
  await page.goto(url, { waitUntil: 'networkidle' });
  await page.waitForFunction(() => window.__pp, null, { timeout: 15000 });
  await sleep(700);
  await page.locator('#game').screenshot({ path: file });
  shotSizes[file] = statSync(file).size;
}

async function main() {
  const server = spawn('node', ['serve.ts'], { cwd: ROOT, stdio: 'pipe' });
  let serverLog = '';
  server.stdout.on('data', (d) => (serverLog += d));
  server.stderr.on('data', (d) => (serverLog += d));
  try {
    if (!(await waitServer())) {
      console.log('FAIL: server did not start');
      console.log(serverLog);
      process.exitCode = 1;
      return;
    }
    const browser = await chromium.launch({
      executablePath: `${process.env.HOME}/.cache/ms-playwright/chromium-1187/chrome-linux/chrome`,
      headless: true,
      args: ['--no-sandbox'],
    });
    try {
      const page = await browser.newPage({ viewport: { width: 1680, height: 1320 } });
      track(page);

      console.log('--- WIN run ---');
      const win = await runWin(page);
      await setKeys(page, new Set());
      if (win.win) {
        console.log(`WIN ${(win.ms / 1000).toFixed(1)}s score ${win.score} timeLeft ${win.timeLeft.toFixed(1)}s 6/6 pipes`);
      } else {
        console.log(`NO WIN: ${JSON.stringify({ screen: win.screen, timeout: win.timeout, ms: win.ms, score: win.score })}`);
      }

      console.log('--- LOSE run ---');
      const lose = await runLose(page);
      if (lose.lose) {
        console.log(`LOSE by ${lose.loseReason} at ${(lose.ms / 1000).toFixed(1)}s coverage ${(lose.coverage * 100).toFixed(0)}% score ${lose.score}`);
      } else {
        console.log(`NO LOSE: ${JSON.stringify({ won: lose.won, timeout: lose.timeout, ms: lose.ms })}`);
      }

      console.log('--- screenshots ---');
      await capture(page, `${BASE}/game/index.html?shot=start&seed=7`, join(ROOT, 'screenshots/1-start.jpg'));
      await capture(page, `${BASE}/game/index.html?shot=play&seed=7`, join(ROOT, 'screenshots/2-play.jpg'));
      await capture(page, `${BASE}/game/index.html?shot=end&seed=7`, join(ROOT, 'screenshots/3-end.jpg'));
      for (const [f, size] of Object.entries(shotSizes)) {
        console.log(`${f}: ${size} bytes ${size <= 262144 ? 'OK' : 'TOO BIG'}`);
      }

      console.log('--- hygiene ---');
      console.log(`console errors: ${errors.length}`, errors.slice(0, 5));
      console.log(`failed requests: ${failedRequests.length}`, failedRequests.slice(0, 5));
      console.log(`non-localhost requests: ${foreignRequests.length}`, foreignRequests.slice(0, 5));

      const shotsOk = Object.values(shotSizes).every((s) => s <= 262144) && Object.keys(shotSizes).length === 3;
      const ok = win.win && lose.lose && errors.length === 0 && failedRequests.length === 0 && foreignRequests.length === 0 && shotsOk;
      console.log(ok ? 'PLAYTEST PASS' : 'PLAYTEST FAIL');
      process.exitCode = ok ? 0 : 1;
    } finally {
      await browser.close();
    }
  } finally {
    server.kill();
  }
}

main();
