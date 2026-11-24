import { createRequire } from 'node:module';
import { spawn } from 'node:child_process';
import { readFileSync, writeFileSync, mkdirSync, statSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire('/home/hatch/workspace/makefun/best-game-01/node_modules/');
const { chromium } = require('playwright');

const here = dirname(fileURLToPath(import.meta.url));
const BASE = 'http://127.0.0.1:8905';
const errors = [];

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function waitServer(tries = 40) {
  for (let i = 0; i < tries; i++) {
    try {
      const res = await fetch(BASE + '/game/index.html');
      if (res.ok) return true;
    } catch (e) {
      // not up yet
    }
    await sleep(250);
  }
  return false;
}

async function main() {
  const server = spawn('node', ['serve.ts'], {
    cwd: here,
    env: { ...process.env, PORT: '8905' },
    stdio: 'pipe',
  });
  server.stderr.on('data', (d) => errors.push('server: ' + String(d).slice(0, 200)));
  const up = await waitServer();
  if (!up) {
    console.log('SERVER FAILED TO START');
    server.kill();
    process.exit(1);
  }

  const browser = await chromium.launch();
  const results = {};

  async function newPage() {
    const page = await browser.newPage({ viewport: { width: 1280, height: 960 } });
    page.on('console', (m) => {
      if (m.type() === 'error') errors.push('console: ' + m.text());
    });
    page.on('pageerror', (e) => errors.push('pageerror: ' + String(e)));
    page.on('requestfailed', (r) => {
      if (!r.url().startsWith('http://127.0.0.1')) errors.push('reqfail: ' + r.url());
    });
    return page;
  }

  // ---- WIN test: autopilot fixes all 6 pipes ----
  const winPage = await newPage();
  await winPage.goto(BASE + '/game/index.html?seed=7');
  await winPage.waitForFunction(() => window.__ppReady, null, { timeout: 10000 });
  await winPage.evaluate(() => window.__pp.start());
  const winState = await winPage.evaluate(async () => {
    const pp = window.__pp;
    const sleep2 = (ms) => new Promise((r) => setTimeout(r, ms));
    const t0 = Date.now();
    while (Date.now() - t0 < 170000) {
      const s = pp.state();
      if (s.over) return { ...s, realMs: Date.now() - t0 };
      const w = pp.world();
      const bursts = w.pipes.filter((p) => p.state === 'burst');
      if (!bursts.length) {
        await sleep2(200);
        continue;
      }
      let best = null;
      let bd = 1e9;
      for (const p of bursts) {
        const d = Math.hypot(p.x * 40 + 20 - w.player.x, p.y * 40 + 20 - w.player.y);
        if (d < bd) {
          bd = d;
          best = p;
        }
      }
      pp.warp(best.x, best.y);
      pp.keys['KeyE'] = true;
      await sleep2(300);
      pp.keys['KeyE'] = false;
    }
    return { ...pp.state(), realMs: Date.now() - t0, timedOut: true };
  });
  results.win = winState;
  console.log('WIN TEST:', JSON.stringify(winState));
  await winPage.close();

  // ---- LOSE test: idle until flood ----
  const losePage = await newPage();
  await losePage.goto(BASE + '/game/index.html?seed=7');
  await losePage.waitForFunction(() => window.__ppReady, null, { timeout: 10000 });
  await losePage.evaluate(() => window.__pp.start());
  let loseState = null;
  for (let i = 0; i < 75; i++) {
    await sleep(2000);
    loseState = await losePage.evaluate(() => window.__pp.state());
    if (loseState.over) break;
  }
  results.lose = loseState;
  console.log('LOSE TEST:', JSON.stringify(loseState));
  await losePage.close();

  // ---- Screenshots from shots.json ----
  const shots = JSON.parse(readFileSync(join(here, 'shots.json'), 'utf8')).shots;
  mkdirSync(join(here, 'screenshots'), { recursive: true });
  const shotPage = await newPage();
  for (const s of shots) {
    await shotPage.goto(BASE + '/game/index.html?seed=' + s.seed + '&shot=' + s.shot);
    await shotPage.waitForFunction(() => window.__ppReady, null, { timeout: 10000 });
    await sleep(400);
    const file = join(here, 'screenshots', s.name + '.jpg');
    await shotPage.screenshot({ path: file, type: 'jpeg', quality: 80 });
    const size = statSync(file).size;
    console.log('SHOT', s.name, size, 'bytes');
    results['shot_' + s.name] = size;
  }
  await shotPage.close();

  await browser.close();
  server.kill();

  console.log('ERRORS:', errors.length ? JSON.stringify(errors) : 'none');
  const pass = winState.won && winState.pipesFixed === 6 && loseState.over && loseState.loseReason === 'flood' && errors.length === 0;
  console.log(pass ? 'PLAYTEST PASS' : 'PLAYTEST FAIL');
  process.exit(pass ? 0 : 1);
}

main().catch((e) => {
  console.error('playtest crashed:', e);
  process.exit(1);
});
