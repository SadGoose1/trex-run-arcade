# T-Rex Run (MakeCode Arcade, 100% Block Code)

A Chrome-Dino-inspired endless runner built **entirely with MakeCode Arcade blocks** (`main.blocks` — no hand-written code). Open this repository with MakeCode Arcade via **Import Project → Import URL**, **Play it: https://arcade.makecode.com/S80558-54191-94682-02972**

## How to Play
- **A** (hold for higher): Jump. **DOWN**: duck under birds.
- **B**: DONE — finish the run anytime (confetti + your score).
- Score climbs every 100 ms; **3 lives**, mercy-blink after a hit.
- **Every 500 points = STAGE UP!** Press A to continue: the game speeds up (up to 350 px/s) and gets denser — Stage 2 adds bird pairs to duck, Stage 3+ doubles trees and cacti.
- Running out of lives shows the T-Rex laid out flat on the ground on the game-over screen.

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
