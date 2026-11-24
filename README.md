# Pipe Panic!

[![make.fun](https://make.fun/badge/gta6-01.svg)](https://make.fun/bounty/gta6-01)
[![rank](https://make.fun/badge/gta6-01/kuaixiangjie-commits/pipe-panic/rank.svg)](https://make.fun/bounty/gta6-01)
[![reward](https://make.fun/badge/gta6-01/kuaixiangjie-commits/pipe-panic/reward.svg)](https://make.fun/bounty/gta6-01)

A 2D top-down plumber game. Harborview Apartments in Copperton is flooding,
and you are Pip Calloway, the plumber on call. Six pipes have burst across
seven rooms. Fix them all before the water hits 75% — or the 180-second shift
runs out.

## How to play

- Move: WASD or arrow keys
- Repair and mop: hold E near a burst pipe (or a wet floor)
- Pause: P — restart after a win or loss: R or Enter
- Pickups: wrench (repair 2x for 12s), coffee (move faster for 12s),
  three rubber ducks (+50 points each)
- Pressure rises through CALM, BUSY, RUSH and FLOODING; at high pressure,
  weak pipes can burst mid-shift

## Run it

```sh
node serve.ts
```

Then open http://127.0.0.1:8905/ — no build step, no external assets.
All art is drawn on canvas and all sound is WebAudio.

## Test it

```sh
node playtest.mjs
```

Runs a headless win playthrough, a flood loss, and captures the three
screenshots in `screenshots/`.
