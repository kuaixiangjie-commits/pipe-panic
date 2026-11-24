// The screenshot scenes behind ?shot=start|play|end. Each one plays the real
// rules forward from a fresh world for a fixed number of steps, steered by a
// simple autopilot (breadth-first search over the floor grid to the nearest
// burst pipe, hold E when in reach), so the frame is what a short shift
// really looks like and the same seed always gives the same frame. The end
// scene's pilot only wanders and never repairs, so the water wins, as it
// would for a player who stood still.

import { PLAYER, STEP } from './config.js';
import { EVENT_OVER, EVENT_WIN } from './world.js';
import { SCREEN_OVER, SCREEN_PLAY, SCREEN_TITLE, SCREEN_WIN } from './render.js';
import { findPath } from './map.js';

const START_SECONDS = 5;
const PLAY_SECONDS = 25;
const END_LIMIT_SECONDS = 300;
const REPATH_SECONDS = 0.5;

/** Where the wandering pilot strolls, room by room, in order. */
const WANDER_GOALS = [
  { x: 800, y: 620 },
  { x: 400, y: 220 },
  { x: 1200, y: 220 },
  { x: 1400, y: 600 },
  { x: 1200, y: 1000 },
  { x: 400, y: 1000 },
  { x: 200, y: 600 },
];

function nearestUnfixedPipe(state) {
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
  return best;
}

/** Move toward the first waypoint of `path`, dropping waypoints already reached. */
function moveAlong(path, state) {
  let guard = 0;
  while (path.length > 0 && guard < 4) {
    const next = path[0];
    const dx = next.x - state.player.x;
    const dy = next.y - state.player.y;
    if (Math.hypot(dx, dy) < 8) {
      path.shift();
      guard += 1;
      continue;
    }
    return {
      x: dx !== 0 ? Math.sign(dx) : 0,
      y: dy !== 0 ? Math.sign(dy) : 0,
    };
  }
  return { x: 0, y: 0 };
}

function makePilot() {
  let path = null;
  let pathTarget = null;
  let repathIn = 0;
  return {
    steer(state, dt) {
      repathIn -= dt;
      const pipe = nearestUnfixedPipe(state);
      const target = pipe !== null ? { x: pipe.x, y: pipe.y } : { x: 800, y: 620 };
      const moved = pathTarget === null || Math.hypot(target.x - pathTarget.x, target.y - pathTarget.y) > 1;
      if (path === null || path.length === 0 || repathIn <= 0 || moved) {
        path = findPath(state.map.blocked, state.player.x, state.player.y, target.x, target.y) || [];
        pathTarget = target;
        repathIn = REPATH_SECONDS;
      }
      if (pipe !== null) {
        const d = Math.hypot(pipe.x - state.player.x, pipe.y - state.player.y);
        if (d <= PLAYER.reach) return { move: { x: 0, y: 0 }, action: true };
      }
      return { move: moveAlong(path, state), action: false };
    },
  };
}

function makeWanderer() {
  let path = null;
  let goalIndex = 0;
  let repathIn = 0;
  return {
    steer(state, dt) {
      repathIn -= dt;
      const goal = WANDER_GOALS[goalIndex % WANDER_GOALS.length];
      const arrived = Math.hypot(goal.x - state.player.x, goal.y - state.player.y) < 24;
      if (path === null || path.length === 0 || repathIn <= 0 || arrived) {
        if (arrived) goalIndex += 1;
        const next = WANDER_GOALS[goalIndex % WANDER_GOALS.length];
        path = findPath(state.map.blocked, state.player.x, state.player.y, next.x, next.y) || [];
        repathIn = REPATH_SECONDS;
      }
      return { move: moveAlong(path, state), action: false };
    },
  };
}

/**
 * Set `world` to the named scene (start, play or end; any other name is start)
 * and return the screen to draw over it and the best score to show.
 */
export function stageShot(name, world) {
  world.reset();
  if (name !== 'play' && name !== 'end') {
    for (let index = 0; index < START_SECONDS / STEP; index += 1) {
      world.step(STEP, { x: 0, y: 0 }, false, true);
    }
    return { screen: SCREEN_TITLE, best: 0 };
  }
  if (name === 'end') {
    const wanderer = makeWanderer();
    for (let index = 0; index < END_LIMIT_SECONDS / STEP; index += 1) {
      const input = wanderer.steer(world.state, STEP);
      if (world.step(STEP, input.move, false, false) & EVENT_OVER) break;
    }
    const over = world.state.over;
    return { screen: over ? SCREEN_OVER : SCREEN_PLAY, best: world.state.score };
  }
  const pilot = makePilot();
  for (let index = 0; index < PLAY_SECONDS / STEP; index += 1) {
    const input = pilot.steer(world.state, STEP);
    if (world.step(STEP, input.move, input.action, false) & (EVENT_OVER | EVENT_WIN)) break;
  }
  const state = world.state;
  return {
    screen: state.over ? SCREEN_OVER : state.won ? SCREEN_WIN : SCREEN_PLAY,
    best: state.score,
  };
}
