// Pipe Panic! — boot, main loop, screen transitions, and the debug handle
// the autopilot uses (window.__pp). Classic ES modules over HTTP.
import { World } from "./world.js";
import { Renderer } from "./render.js";
import { Input } from "./input.js";
import { Sound } from "./sound.js";
import { applyShot } from "./shots.js";

const canvas = document.getElementById("game");
const world = new World();
const renderer = new Renderer(canvas);
const input = new Input();
const sound = new Sound();

// Stage a deterministic scene when the URL asks for one (?shot=...).
applyShot(world, window.location.search);

// Handle the autopilot reads (state only — it steers with real key events).
const game = { world, input, sound, snapshot: () => world.snapshot() };
window.__pp = game;

let last = performance.now();
function frame(now) {
  const dt = Math.min(0.033, Math.max(0, (now - last) / 1000));
  last = now;

  if (world.screen === "title" && (input.wasPressed("Space") || input.wasPressed("Enter") || input.wasClicked())) {
    sound.unlock();
    sound.click();
    world.start();
  } else if (world.screen === "playing" && (input.wasPressed("KeyP") || input.wasPressed("Escape"))) {
    world.screen = "paused";
  } else if (world.screen === "paused" && (input.wasPressed("KeyP") || input.wasPressed("Escape") || input.wasPressed("Space"))) {
    world.screen = "playing";
  } else if (
    (world.screen === "win" || world.screen === "lose") &&
    (input.wasPressed("Space") || input.wasPressed("Enter") || input.wasClicked())
  ) {
    sound.unlock();
    sound.click();
    world.start();
  }

  world.update(dt, input, sound);
  renderer.draw(world);
  input.endFrame();
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
