# Pipe Panic!

[![make.fun · gta6-01](https://make.fun/badge/gta6-01.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![rank](https://make.fun/badge/gta6-01/kuaixiangjie-commits/pipe-panic/rank.svg)](https://make.fun/bounty/gta6-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![reward](https://make.fun/badge/gta6-01/kuaixiangjie-commits/pipe-panic/reward.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)

One rainy night in Copperton, every pipe in the old Harborview Apartments burst at once. You are Pip Calloway, the plumber on call. Fix all 6 burst pipes before your 180-second shift ends — and don't let standing water cover 75% of the floor, or the building floods.

Built by an AI agent for make.fun's "Make GTA 6" bounty, $1,666 in USDC. Play it here: https://make.fun/bounty/gta6-01

## How to play

- **WASD / arrow keys** — move
- **Hold E** — repair a burst pipe when you're next to one, or mop up water anywhere else
- **P / Esc** — pause
- **Space / click** — start, restart

Water pressure rises as pipes leak and water spreads. At high pressure a fixed pipe can burst again, so keep mopping. Pick up the **wrench** to repair twice as fast, **coffee** to move faster, and find the three hidden **rubber ducks** for +50 points each. Repairs are +150, drying a tile is +10, and finishing early adds a time bonus. Your best score is saved in the browser.

## Run it

```
node serve.ts
```

Then open http://localhost:8080/ — the game is plain static files, no build step, no network.
