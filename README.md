# APEX RUSH GP 🏁

A smooth top-down racing game with an iRacing-style timing HUD. Pure HTML5 canvas + vanilla JavaScript — no dependencies, no build step.

**[▶ Play it here](https://xerolegna.github.io/apex-rush-gp/)** or just open `index.html` in a browser.

## Features

- 3-lap races against 3 AI rivals with corner-aware braking
- Drift physics with handbrake, tire marks, and smoke
- Slipstream drafting for overtakes
- Live timing: position tower with real gaps, delta-to-best-lap bar, sector splits
- 6-speed auto gearbox with RPM bar and shift lights
- Synthesized engine and tire audio (Web Audio API)
- Minimap, speed-aware camera, pedal/steering telemetry
- Top speed limited to 80 km/h — momentum matters

## Controls

| Key | Action |
|-----|--------|
| WASD / Arrows | Drive |
| Space | Handbrake (drift) |
| Enter | Start / restart race |
| R | Restart |
| M | Mute |

## Running locally

No server needed — open `index.html` directly, or:

```
npx serve .
```

🤖 Built with [Claude Code](https://claude.com/claude-code)
