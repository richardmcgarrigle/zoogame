# Project Canopy

A cozy 2D physics sandbox where you play as a chunky elephant kicking fruit into a goal across a procedurally generated jungle world.

Built with **Phaser 3** + **Matter.js** physics, bundled with **Vite**.

---

## Installation

**Prerequisites:** Node.js 18+

```bash
git clone <repo-url>
cd zoogame
npm install
npm run dev
```

Open the URL printed in the terminal (default: `http://localhost:5173`).

### Other scripts

| Command | Description |
|---|---|
| `npm run dev` | Start dev server with hot reload |
| `npm run build` | Production bundle to `dist/` |
| `npm run preview` | Serve the production build locally |

---

## Controls

### Keyboard

| Action | Key |
|---|---|
| Move | Arrow keys or A / D |
| Jump | Up arrow or W |
| Dash | Space |
| Ear-glide (hold while airborne) | Shift |
| Trunk swat | X |
| Restart level (keep score) | R |

### Gamepad (DualSense / Standard Gamepad)

| Action | Button |
|---|---|
| Move | Left stick or D-pad left/right |
| Jump | Cross (×) or D-pad up |
| Dash | Square (□) |
| Ear-glide (hold while airborne) | L1 or L2 or Circle |
| Trunk swat | Triangle (△) |

Use the **Controller** dropdown in the top bar to pick your gamepad if more than one is connected.

---

## Scope

Project Canopy is a **vertical slice / prototype** intended to prove out the core game feel before committing to full production. The goals of this slice are:

- Validate that heavy, deliberate elephant movement feels satisfying
- Test the ear-glide drift as a skill-expressive traversal mechanic
- Confirm physics-driven fruit kicking produces interesting, emergent moments
- Establish a procedural level generation baseline that scales with score

### What is built

- Elephant player with run, jump, dash, ear-glide, and trunk-swat actions
- Matter.js physics for the elephant, fruit, and crate — all react to each other
- Procedural terrain with bumpy ground that ramps up with score
- Procedural platform placement — count, angle, and height increase with score
- Three fruit types: orange, apple, and melon (larger and heavier)
- Goal scoring: kick any fruit into the goal net to score
- Off-screen directional arrows for both the goal and active fruit
- World grows wider on each goal, with terrain amplitude increasing
- Palm tree background decoration, moving clouds
- Gamepad support with controller selection dropdown
- R-key restart that preserves the current score

### Out of scope (future work)

- Audio (SFX, ambient jungle sounds, music)
- Crate/prop destruction into rolling debris pieces
- Bendable/deformable platforms
- World evolution (toppled trees creating bridges, mushroom platforms)
- Enemy or NPC characters
- Persistent high-score storage
- Mobile / touch controls

---

## Architecture

```
src/
├── main.js                  # Phaser game config, scene list, gamepad enable
├── scenes/
│   └── PlaygroundScene.js   # World creation, physics, scoring, camera, HUD
├── objects/
│   └── Elephant.js          # Player controller — input, movement, animations
└── util/
    └── textures.js          # Runtime texture generation via Phaser Graphics
```

### Key design decisions

**Procedural textures** — all non-elephant art is generated at runtime with `Graphics.generateTexture()`. This eliminates asset pipeline friction during prototyping and keeps the visual style consistent (thick outlines, flat fills).

**Matter.js labels** — bodies are tagged (`'elephant'`, `'fruit'`, `'platform'`, `'ground'`, `'crate'`) so collision handlers can distinguish them without needing object references.

**Platforms vs ground** — only elevated platforms apply an extra bounce force to fruit; the ground floor uses normal restitution. This is enforced by the `'platform'` label check in the collision handler.

**Camera anchoring** — the camera uses `lerpY = 0` and a fixed `scrollY = WORLD_HEIGHT - viewportHeight` so the floor always sits at the bottom of the viewport regardless of window height.

**Gamepad justDown** — Phaser's `GamepadButton` has no `justDown` property. Manual tracking via `_prevPadButtons` (a map of `padIndex_buttonIndex → boolean`) is flushed each frame after input is processed.

---

## BDD Scenarios

The following scenarios describe expected behaviour in plain language. They serve as acceptance criteria for manual testing and as a baseline for automated tests if a test framework is introduced later.

### Elephant movement

```
Given the elephant is on the ground
When the player holds left or right (or tilts the left stick)
Then the elephant moves horizontally at walking speed

Given the elephant is on the ground
When the player presses Jump
Then the elephant launches upward

Given the elephant is airborne and moving downward
When the player holds Glide
Then the elephant falls slowly and can drift horizontally
And the ear sprites become visible and animate

Given the elephant is standing still or moving
When the player presses Dash
Then the elephant bursts forward in the facing direction at high speed for ~140ms
And the dash cannot be triggered again for 600ms
```

### Fruit and kicking

```
Given a fruit is on the ground near the elephant
When the elephant walks into the fruit
Then the fruit launches away from the elephant with a kick impulse

Given a fruit is airborne
When the fruit lands on a platform
Then the fruit bounces with amplified force (more than normal restitution)

Given a fruit is airborne
When the fruit lands on the floor (ground terrain)
Then the fruit bounces with normal restitution only (no extra boost)

Given a melon is spawned
Then it is visually larger than an orange or apple
And it is heavier, making it harder to kick far
```

### Scoring and world

```
Given the fruit is inside the goal area
When a collision is detected between the fruit and the goal sensor
Then the score increments by 1
And the current fruit is destroyed and a new random fruit spawns
And the world becomes wider by WIDTH_PER_SCORE pixels
And terrain amplitude increases
And platforms become more numerous and more angled

Given the elephant presses R at any time
Then the level geometry is rebuilt (ground, platforms, palms)
And the fruit and crate are respawned at their default positions
And the elephant is reset to the spawn point
And the score is preserved
```

### Off-screen indicators

```
Given the goal is off-screen to the right
Then a coloured arrow appears on the right edge of the screen pointing toward the goal

Given the fruit is above and to the right of the visible area
Then a coloured arrow appears on the upper-right edge of the screen
And the arrow rotates to point at the fruit's world position

Given either target moves back into the visible area
Then its arrow disappears
```

### Gamepad

```
Given a gamepad is connected
When the player opens the Controller dropdown
Then the connected gamepad appears by name

Given a specific gamepad is selected in the dropdown
Then only that gamepad's input is used for the elephant

Given Cross (×) is pressed on the DualSense while the elephant is grounded
Then the elephant jumps

Given Square (□) is pressed on the DualSense
Then the elephant dashes in the current facing direction
```

---

## Contributing

This is a personal prototype. No formal contribution process is defined yet. If you fork it, `npm run dev` is all you need to get started.
