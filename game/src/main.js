// Pipe Panic! entrypoint: wires input, world, renderer and sound, runs the loop.
import { World } from "./world.js";
import { Renderer } from "./render.js";
import { Input } from "./input.js";
import { Sound } from "./sound.js";
import { applyShot } from "./shots.js";

const canvas = document.getElementById("game");
const input = new Input();
const sound = new Sound();
const renderer = new Renderer(canvas);

function seedFromUrl() {
  const s = new URLSearchParams(location.search).get("seed");
  const n = Number(s);
  return Number.isFinite(n) && n > 0 ? n >>> 0 : (Math.random() * 1e9) >>> 0;
}

let world = new World(seedFromUrl());

function wire(w) {
  w.onPickup = (kind) => {
    if (kind === "duck") sound.duck();
    else sound.pickup();
  };
  w.onRepairTick = () => sound.repairTick();
  w.onFixed = () => sound.fixed();
  w.onReburst = () => sound.reburst();
  w.onWin = () => sound.win();
  w.onLose = () => sound.lose();
}

wire(world);
applyShot(world, location.search);

function restart() {
  world = new World((Math.random() * 1e9) >>> 0);
  wire(world);
  world.start();
  sound.resume();
}

let last = performance.now();
function frame(now) {
  const dt = Math.min(0.05, Math.max(0, (now - last) / 1000));
  last = now;
  if (input.consume("Space") || input.consume("Enter")) {
    if (world.screen === "title") {
      world.start();
      sound.resume();
    } else if (world.screen === "win" || world.screen === "lose") {
      restart();
    }
  }
  if (input.consume("KeyP") || input.consume("Escape")) {
    if (world.screen === "playing") world.screen = "paused";
    else if (world.screen === "paused") world.screen = "playing";
  }
  if (world.screen === "playing") world.update(dt, input);
  renderer.draw(world, now);
  input.endFrame();
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

canvas.addEventListener("click", () => {
  if (world.screen === "title") {
    world.start();
    sound.resume();
  } else if (world.screen === "win" || world.screen === "lose") {
    restart();
  }
});

// Debug / automation handle: the autopilot reads state and the grid from here.
window.__pp = {
  get world() {
    return world;
  },
  input,
  sound,
  snapshot: () => world.snapshot(),
};
