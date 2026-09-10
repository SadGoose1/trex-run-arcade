# T-Rex Run (MakeCode Arcade, 100% Block Code)

A Chrome-Dino-inspired endless runner built **entirely with MakeCode Arcade blocks** (`main.blocks` — no hand-written code). Open this repository with MakeCode Arcade via **Import Project → Import URL**, or use the shared project link.

## How to Play
- **A** (or Space): Jump over cacti. Jump over birds too — or **DOWN** to duck under them.
- Score climbs every 100 ms — the longer you survive, the higher your score.
- **3 lives.** Hitting an obstacle costs a life (with 1.5 s mercy-blink afterwards).
- Reach **500 points** to win the champion screen!

## Power-ups (spawn every ~7 seconds)
| Icon | Name | Effect |
|------|------|--------|
| ★ | Star | 5 s of invincibility — the dino turns gold and smashes obstacles for +50 points each |
| ♥ | Heart | +1 life (up to 5) |
| ⚡ | Bolt | 5 s of slow-motion — everything in the world slows to half speed |

## Progression & Challenge
- World speed ramps from 100 → 250 as your score grows.
- Cacti come in two sizes; birds flap in and require jump **or** duck decisions.
- **Day/night cycle:** every 150 points the sky flips to night with a drifting moon, then back to day.

## Presentation
- Title screen with name + instructions, animated running/flapping sprites, parallax clouds,
  merciful hit-blinking, chiptune background music, jump/power-up/hit sound effects, and a
  game-over / champion screen (auto-restarts on any button press).

## Project structure
- `main.blocks` — the entire game as block XML (open in the Blocks editor)
- `pxt.json` — MakeCode Arcade project manifest (`preferredEditor: blocksprj`)
- `main.ts`, `assets.json` — empty placeholders required by the project format

```package
T-Rex Run
```
