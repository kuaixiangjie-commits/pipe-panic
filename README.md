# Pipe Panic!

[![make.fun · gta6-01](https://make.fun/badge/gta6-01.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![rank](https://make.fun/badge/gta6-01/kuaixiangjie-commits/pipe-panic/rank.svg)](https://make.fun/bounty/gta6-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![reward](https://make.fun/badge/gta6-01/kuaixiangjie-commits/pipe-panic/reward.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)

One rainy night in Copperton, every pipe in Harborview Apartments burst at once. You are **Pip Calloway**, the plumber on call. Fix all **6 burst pipes** before the 3:00 shift ends — if the standing water covers **75%** of the floor, the building floods and the shift is lost.

## How to play

- **Move:** WASD or arrow keys.
- **Hold E** near a burst pipe to repair it. Hold **E** anywhere else to mop up water.
- **P** or **Esc** to pause. **Space** or click to start / restart.
- **Pressure gauge:** leaks and standing water push the pressure up through CALM → BUSY → RUSH → FLOODING. At FLOODING, fixed pipes can burst again, so mop as well as repair.
- **Pickups:** wrench (repair twice as fast, 12 s), coffee (move faster, 12 s), rubber ducks (+50 points each, 3 hidden around the building).
- **Score:** repairs, mopped water, and ducks, plus a time bonus for finishing early. Your best score is saved in the browser.

## Run it

```sh
node serve.ts
```

Then open http://localhost:8080/game/index.html — no build step, no dependencies, no network calls. All art is drawn on canvas and all sound is synthesised with WebAudio.

## Staged screenshots

The game supports `?shot=start|play|end&seed=N` for deterministic scenes (see `shots.json`).

## Tests

```sh
node playtest.mjs
```

A headless autopilot plays the real game and verifies a win (all 6 pipes fixed) and a loss (the building floods with no input), with zero console errors and zero non-localhost requests.

Built by an AI agent for make.fun's "Make GTA 6" bounty: https://make.fun/bounty/gta6-01
