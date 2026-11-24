// Playtest for Pipe Panic! — run AFTER the go-ahead to execute in this repo.
//   node playtest.mjs
// Needs Playwright with Chromium available (npx playwright install chromium).
// What it does:
//   1. Starts serve.ts on http://localhost:8080 and waits for it.
//   2. Loads the game, asserts no console errors and no requests outside
//      localhost (the game must make zero network requests of its own).
//   3. Smoke-plays the live game: Space to start, move, hold E, P to pause,
//      P to resume; asserts the canvas keeps animating.
//   4. Captures the three staged shots (?shot=start|play|end&seed=1) into
//      screenshots/ (names from shots.json) and checks each is <= 256 KiB.
//   5. Stops the server and prints a PASS/FAIL summary. Exit code 0 = pass.
import { spawn } from 'node:child_process';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repo = path.dirname(fileURLToPath(import.meta.url));
const base = 'http://127.0.0.1:8080';
const shots = [
  { query: '?shot=start&seed=1', file: '1-start.jpg' },
  { query: '?shot=play&seed=1', file: '2-play.jpg' },
  { query: '?shot=end&seed=1', file: '3-end.jpg' },
];
const failures = [];
function fail(message) {
  failures.push(message);
  console.error('FAIL:', message);
}

const server = spawn('node', ['serve.ts'], { cwd: repo, stdio: ['ignore', 'pipe', 'pipe'] });
let serverLog = '';
server.stdout.on('data', (chunk) => { serverLog += chunk; });
server.stderr.on('data', (chunk) => { serverLog += chunk; });

async function waitForServer() {
  const deadline = Date.now() + 15000;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(`${base}/`);
      if (response.ok) return;
    } catch {
      // Not up yet.
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error(`serve.ts did not answer within 15s. Log so far:\n${serverLog}`);
}

let browser;
try {
  const { chromium } = await import('playwright');
  await waitForServer();
  browser = await chromium.launch({ headless: true, executablePath: process.env.CHROMIUM_PATH || undefined });
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  const consoleErrors = [];
  const outsideRequests = [];
  page.on('console', (message) => {
    if (message.type() === 'error') consoleErrors.push(message.text());
  });
  page.on('pageerror', (error) => consoleErrors.push(String(error)));
  page.on('request', (request) => {
    if (!request.url().startsWith(base)) outsideRequests.push(request.url());
  });

  // Live smoke play: title -> start -> move -> hold E -> pause -> resume.
  await page.goto(`${base}/`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(600);
  const firstFrame = await page.screenshot({ type: 'png' });
  await page.keyboard.press('Space');
  await page.waitForTimeout(1000);
  await page.keyboard.down('KeyD');
  await page.waitForTimeout(1200);
  await page.keyboard.up('KeyD');
  await page.keyboard.down('ArrowUp');
  await page.waitForTimeout(800);
  await page.keyboard.up('ArrowUp');
  await page.keyboard.down('KeyE');
  await page.waitForTimeout(2000);
  await page.keyboard.up('KeyE');
  const statusAfterWork = await page.locator('#status').textContent();
  await page.keyboard.press('KeyP');
  await page.waitForTimeout(300);
  const statusPaused = await page.locator('#status').textContent();
  await page.keyboard.press('KeyP');
  await page.waitForTimeout(1500);
  const laterFrame = await page.screenshot({ type: 'png' });
  if (!statusAfterWork.includes('Playing')) fail(`status after start was "${statusAfterWork}"`);
  if (!statusPaused.includes('Paused')) fail(`status after P was "${statusPaused}"`);
  if (firstFrame.equals(laterFrame)) fail('canvas did not change between frames (game may be frozen)');
  console.log('Live smoke play: start/move/repair-hold/pause/resume done.');

  // Staged shots.
  for (const shot of shots) {
    await page.goto(`${base}/${shot.query}`, { waitUntil: 'domcontentloaded' });
    try {
      await page.waitForFunction(() => window.__shotReady === true, null, { timeout: 30000 });
    } catch {
      fail(`${shot.file}: __shotReady never became true`);
      continue;
    }
    const out = path.join(repo, 'screenshots', shot.file);
    await page.screenshot({ path: out, type: 'jpeg', quality: 75 });
    const size = (await fs.stat(out)).size;
    console.log(`${shot.file}: ${size} bytes`);
    if (size > 262144) fail(`${shot.file} is ${size} bytes, over the 256 KiB cap`);
  }

  if (consoleErrors.length > 0) fail(`console errors: ${consoleErrors.join(' | ')}`);
  if (outsideRequests.length > 0) fail(`requests outside localhost: ${outsideRequests.join(', ')}`);
} catch (error) {
  fail(error instanceof Error ? error.message : String(error));
} finally {
  if (browser) await browser.close().catch(() => {});
  server.kill('SIGTERM');
}

if (failures.length > 0) {
  console.error(`\nPLAYTEST FAILED (${failures.length} issue${failures.length === 1 ? '' : 's'})`);
  process.exitCode = 1;
} else {
  console.log('\nPLAYTEST PASSED: no console errors, no outside requests, shots captured within size cap.');
}
