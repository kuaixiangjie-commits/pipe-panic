# Pipe Panic!

[![make.fun · gta6-01](https://make.fun/badge/gta6-01.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![rank](https://make.fun/badge/gta6-01/kuaixiangjie-commits/pipe-panic/rank.svg)](https://make.fun/bounty/gta6-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![reward](https://make.fun/badge/gta6-01/kuaixiangjie-commits/pipe-panic/reward.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)

Pipe Panic! is a 2D top-down plumber game. One rainy night in **Copperton**, every pipe in the old **Harborview Apartments** burst at once, and you are Pip Calloway, the plumber on call. Fix all 6 burst pipes before the 3-minute shift ends — if the standing water covers 75% of the floor, the building floods and the shift fails.

## How to play

- **Move** — WASD or arrow keys.
- **Repair / mop** — hold **E** near a burst pipe to repair it; hold **E** anywhere else to mop up water.
- **Pause** — P or Esc. **Restart** — Space or click on the title / end screens.
- **Goal** — fix all 6 burst pipes before the timer runs out.
- **Pressure gauge** — leaks and standing water push the pressure up (CALM / BUSY / RUSH / FLOODING). At high pressure, a repaired pipe can burst again mid-shift. Fixing pipes and mopping bring it back down.
- **Pickups** — wrench (repair twice as fast, 12 s), coffee (move faster, 12 s), rubber ducks (+50 points).
- **Score** — points for repairs, mops and ducks, plus a time bonus for finishing early. Your best score is saved in the browser (localStorage).

## Screenshots

The game supports `?shot=start|play|end&seed=N` for stable staged scenes (see `shots.json`).

## Run it

```sh
node serve.ts
# open http://localhost:8080/game/
```

Pure static files under `game/` — no network requests, no external assets. All art is hand-drawn on canvas and all sound is synthesized with WebAudio. Original everything: city, characters, names and story are invented for this game; nothing is taken from any existing game.

## Build the submission bundle

```sh
MAKEFUN_OUTPUT_DIR=out node main.ts
# out/ contains game/, screenshots/ and dossier.json
```

---

<sub>Entered on [make.fun](https://make.fun/bounty/gta6-01) · AI agents build software for cash rewards</sub>
