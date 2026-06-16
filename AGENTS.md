# Agent Architecture Guide — Project Canopy

This document is written for AI agents working on this codebase. It describes the architecture, file responsibilities, key invariants, data flow, and common pitfalls in enough detail to make safe edits without reading every file first.

---

## Stack

| Concern | Library / Tool |
|---|---|
| Rendering + scene management | Phaser 3 (`phaser@^3.80`) |
| Physics | Matter.js (Phaser's built-in plugin, accessed via `this.matter`) |
| Bundler | Vite 5 |
| Language | ES Modules (vanilla JS, no TypeScript) |
| Node requirement | 18+ |

---

## File Map

```
src/
├── main.js                        Entry point. Phaser Game config only.
├── scenes/
│   └── PlaygroundScene.js         The only scene. All world state lives here.
├── objects/
│   └── Elephant.js                Player controller. Input + physics + animation.
└── util/
    └── textures.js                Runtime texture generation. No external image I/O.

src/assets/                        Pixel-art PNGs for the elephant sprite frames.
  elephant_idle_1.png
  elephant_run_1.png  elephant_run_2.png
  elephant_jump_up.png  elephant_jump_down.png
  elephant_celebrate.png           Loaded but animation not currently played.
  palmtree.png

index.html                         Minimal shell; mounts #game-container.
vite.config.js
package.json                       name: "project-canopy"
```

---

## Module Responsibilities

### `src/main.js`
Constructs the single `Phaser.Game` instance. Responsibilities end there.

Key config points:
- `Scale.RESIZE` — canvas fills the window; scene receives resize events.
- `input: { gamepad: true }` — required for `this.scene.input.gamepad` to be non-null.
- `matter.gravity.y = 1` (not the default 1.2).
- Single scene: `PlaygroundScene`.

**Do not add game logic here.**

---

### `src/util/textures.js`

Exports:
- `generatePlaceholderTextures(scene)` — called once in `PlaygroundScene.create()`. Draws every procedural texture (platforms, fruit, crate, goal, HUD elements) using `scene.add.graphics()` + `generateTexture(key, w, h)`.
- `TEXTURE_SIZES` — plain object keyed by texture name. The `width`/`height` values are the authoritative sizes used everywhere that code needs to know how big a texture is (physics body sizing, goal half-height, etc.).

**Rules:**
- All textures are generated at scene create time; never load them from disk.
- If you add a new texture, add it to both `generatePlaceholderTextures` and `TEXTURE_SIZES`.
- The elephant frames are real PNGs (not generated) — they are preloaded in `PlaygroundScene.preload()`.

---

### `src/scenes/PlaygroundScene.js`

The scene owns all world state. Everything except elephant input/physics lives here.

#### Instance fields (set in `create()`)

| Field | Type | Description |
|---|---|---|
| `this.worldWidth` | number | Current scrollable world width in pixels |
| `this.terrainAmplitude` | number | Max terrain height deviation; increases with score |
| `this.terrainPoints` | `{x,y}[]` | Sampled ground profile for this round |
| `this.groundBodies` | Matter body[] | Static rectangle bodies making up the ground |
| `this.groundGraphics` | Phaser.Graphics | Visual fill for the ground; destroyed/recreated each round |
| `this.platforms` | Phaser.Matter.Image[] | Elevated leaf platforms; destroyed/rebuilt each round |
| `this.palmTrees` | Phaser.Image[] | Background decoration; rebuilt after platforms |
| `this.goal` | Phaser.Matter.Image | Static sensor body at world right edge |
| `this.fruit` | Phaser.Matter.Image \| null | Active fruit; null briefly after a goal |
| `this.crate` | Phaser.Matter.Image | Heavy box prop |
| `this.props` | array | `[fruit, crate]` — passed to `elephant.update()` for trunk-hit checks |
| `this.elephant` | Elephant | Player instance |
| `this.score` | number | Persists across restarts and world rebuilds |
| `this.clouds` | `{image, speed, baseY}[]` | HUD-space clouds; updated each frame |
| `this.goalArrow` / `this.fruitArrow` | Phaser.Image | Off-screen direction indicators |
| `this.selectedPadIndex` | number | Read by Elephant.js; set by the controller dropdown |

#### Build order — `create()`

```
generatePlaceholderTextures()
buildGround()           ← must come first; sets this.terrainPoints
addGoal()               ← reads terrainPoints via getTerrainYAt()
buildPlatforms()        ← seeds placedBounds with the goal AABB to avoid covering it
buildPalms()            ← must come after buildPlatforms() to read platform x-bands
addFruit() / addCrate()
new Elephant()
camera setup
createIndicatorArrows() / createClouds() / createControllerDropdown()
```

#### Build order — `onGoalScored()`

```
growWorld()             ← updates this.worldWidth; must precede terrain/platform rebuilds
buildGround()           ← regenerates terrainPoints for the new width
repositionGoal()        ← must come BEFORE buildPlatforms() so goal AABB is in placedBounds
buildPlatforms()
buildPalms()
destroy old fruit → delayedCall → addFruit() with random type
```

**Critical invariant:** `repositionGoal()` must always precede `buildPlatforms()`. If the order is reversed, platforms use a stale goal position and can cover the goal mouth.

#### Build order — `restartLevel()`

```
buildGround()
repositionGoal()        ← same order as onGoalScored
buildPlatforms()
buildPalms()
destroy/respawn fruit and crate
reset elephant position + velocity
```

#### Terrain system

- `generateTerrainHeights()` produces `{x, y}[]` with a dual-sine wave controlled by `this.terrainAmplitude`. At score 0, amplitude is 0 (flat ground).
- `buildGround()` materialises these points as a chain of angled static `rectangle` bodies (`label = 'ground'`) and redraws the visual spline.
- `getTerrainYAt(x)` — linear interpolation over `this.terrainPoints`. Used everywhere that needs ground Y at a given X.
- `minTerrainYInRange(minX, maxX)` — samples across a range; returns the highest (lowest Y value) ground point. Used by platform placement to guarantee clearance.

#### Platform placement

Platforms are placed iteratively. Each placement attempt tries random positions and keeps the lowest-overlap candidate. After random search, a deterministic resolution pass nudges along the best escape axis. The algorithm guarantees:
- No platform pokes into the terrain closer than `ELEPHANT_CLEARANCE` (110px).
- No two platforms are so close that the elephant cannot fit between them.
- The goal AABB is always in `placedBounds` so no platform can cover the goal.
- Trees never spawn inside a platform's x-band ± `TREE_MARGIN`.

#### Physics body labels

Every Matter body must have a label set immediately after creation. The collision handler dispatches on these labels:

| Label | Set by | Used in collision for |
|---|---|---|
| `'ground'` | `buildGround()` | Elephant grounding (contact count) |
| `'platform'` | `addStaticPlatform()` | Elephant grounding + fruit bounce boost |
| `'fruit'` | `addFruit()` | Goal scoring, bounce boost, wall bounce, kick |
| `'crate'` | `addCrate()` | Kick impulse from elephant |
| `'elephant'` | `Elephant` constructor | Contact counting, kick source |
| `'goal'` | `addGoal()` | Goal scoring trigger |

**Do not give ground bodies the `'platform'` label.** The extra fruit bounce (`bounceFruitOffPlatform`) must only fire for elevated platforms. Ground bodies use `'ground'` instead, which still counts for elephant grounding via `isPlatformLabel()` in `Elephant.js`.

#### Camera

- `startFollow(elephant.sprite, true, 0.1, 0)` — `lerpX=0.1`, `lerpY=0` (no vertical follow).
- `scrollY` is fixed at `WORLD_HEIGHT - cameras.main.height`. This anchors the floor to the bottom of the viewport. Updated whenever the window resizes (`scale.on('resize')`) or the world grows (`growWorld()`).
- `setBounds(0, -5000, worldWidth, WORLD_HEIGHT + 5000)` — the negative Y origin allows `scrollY` to go negative when the viewport is taller than `WORLD_HEIGHT`, which would otherwise be clamped to 0.

#### Off-screen indicator arrows

`updateIndicatorArrows()` runs each frame. For each target (goal, fruit):
1. Convert target world position to screen position.
2. If within the viewport, hide the arrow.
3. Otherwise, compute direction vector from screen centre to target screen position.
4. Find intersection with the inset rectangle `(cx ± hw, cy ± hh)` using `hw/|dx|` vs `hh/|dy|` test.
5. Position the arrow at that intersection point; rotate it to `Math.atan2(dy, dx)`.
6. Arrow images have `setScrollFactor(0)` — they live in screen space.

---

### `src/objects/Elephant.js`

Owns all player input and movement. Registered with the scene as `this.elephant`.

#### Constructor

Creates a Matter sprite (`matter.add.sprite`) with fixed rotation, high mass (40), and low bounce. Registers collision listeners for ground contact counting and kick impulse dispatch. Creates animation definitions (multi-texture, no spritesheet).

#### Animations

All animations use individual texture keys, not spritesheet frames:
```js
frames: [{ key: 'elephant_idle' }, ...]
```
The Matter physics body dimensions are fixed at the texture size at creation time; changing displayed texture does not change the collider.

Currently defined animations: `elephant-idle`, `elephant-run`, `elephant-jump-up`, `elephant-jump-dn`, `elephant-celebrate` (loaded but not triggered).

#### Input bindings

| Action | Keyboard | Gamepad (DualSense index) |
|---|---|---|
| Move left/right | Arrows / A / D | Left stick or D-pad 14/15 |
| Jump | Up / W | Cross=0, D-up=12 |
| Dash | Space (`cursors.space`) | Square=2 |
| Glide (hold) | Shift | L1=4, L2=6, Circle=1 |
| Trunk swat | X | Triangle=3 |

**Gamepad justDown:** Phaser's `GamepadButton` has no `justDown` property. All one-shot actions use manual tracking via `this._prevPadButtons` (a map of `"padIndex_buttonIndex" → boolean`). This map is flushed at the bottom of each `update()` call after all input is read.

#### `celebrate(duration)` / freeze

`celebrate(duration)` sets `this.celebrateTimer` and zeros velocity. While `celebrateTimer > 0`, the top of `update()` zeros velocity and skips all input/movement logic. Physics, animations, and visuals still run normally. The celebration animation is not played (it plays idle instead).

#### Kick impulse

`applyKickImpulse(elephantBody, propBody)` fires on every `collisionstart` between elephant and any `'fruit'` or `'crate'` body. It always fires — there is no speed threshold. Direction is computed from elephant centre to prop centre so the ball always flies away from contact, even when the elephant is stationary.

#### Dash

Constants in `Elephant.js`:
- `DASH_SPEED = 14`
- `DASH_DURATION = 140` ms
- `DASH_COOLDOWN = 600` ms

During an active dash, normal horizontal movement is suppressed and `setVelocityX(dashDir * DASH_SPEED)` is applied every frame. Dash does not cancel a jump or glide.

#### Gamepad controller selection

`this.scene.selectedPadIndex` is set by the controller dropdown in `PlaygroundScene`. When `-1`, all connected pads are used. When set, only the matching pad's input is read. `allPads` is always built from `this.scene.input.gamepad.gamepads` filtered for non-null entries.

---

## Constants Quick Reference

### `PlaygroundScene.js`

| Constant | Value | Meaning |
|---|---|---|
| `WORLD_HEIGHT` | 1000 | Fixed world height in pixels |
| `GROUND_HEIGHT` | 90 | Visual ground fill height |
| `GROUND_SURFACE_Y` | 910 | Y of the terrain surface baseline |
| `TERRAIN_SEGMENT_WIDTH` | 60 | Pixels per terrain segment |
| `WIDTH_PER_SCORE` | 300 | Extra world width per goal |
| `AMPLITUDE_PER_SCORE` | 12 | Terrain amplitude added per goal |
| `MAX_TERRAIN_AMPLITUDE` | 100 | Terrain amplitude cap |
| `PLATFORM_BASE_COUNT` | 3 | Platforms at score 0 |
| `PLATFORM_PER_SCORE` | 0.5 | Extra platforms per goal |
| `PLATFORM_MAX_COUNT` | 10 | Platform count cap |
| `ELEPHANT_CLEARANCE` | 110 | Min vertical gap below any platform |
| `PLATFORM_GAP_X_MAX` | 220 | Max horizontal gap between chained platforms |
| `PLATFORM_GAP_Y_MAX` | 140 | Max vertical gap between chained platforms |
| `FRUIT_RESPAWN_DELAY` | 700 | ms before new fruit spawns after a goal |

### `Elephant.js`

| Constant | Value | Meaning |
|---|---|---|
| `MOVE_SPEED` | 4.5 | Horizontal velocity on ground |
| `MOVE_SPEED_AIR` | 3.2 | Horizontal velocity in air |
| `JUMP_VELOCITY` | -11 | Y velocity on jump |
| `GLIDE_MAX_FALL` | 1.6 | Max downward velocity while gliding |
| `NORMAL_MAX_FALL` | 11 | Max downward velocity normally |
| `DASH_SPEED` | 14 | X velocity during dash |
| `DASH_DURATION` | 140 | ms a dash lasts |
| `DASH_COOLDOWN` | 600 | ms before next dash is allowed |
| `KICK_MIN_SPEED` | 0.5 | Floor for kick speed even when stationary |
| `KICK_POWER_SCALE` | 1.6 | Multiplier on kick horizontal speed |
| `BODY_SCALE` | 0.4 | Sprite + physics body display scale |

---

## Common Pitfalls

**Adding a new body type:** Always set `body.label` immediately. Forgetting a label means the collision handler silently ignores the body.

**World rebuild order:** Never call `buildPlatforms()` before `repositionGoal()`. The goal's AABB must be in `placedBounds` before the platform loop starts.

**Terrain must exist before everything else:** `buildGround()` populates `this.terrainPoints`. Any call to `getTerrainYAt()` before that will throw (array is undefined). Maintain the build order documented above.

**Camera bounds must use negative Y:** If you tighten `setBounds` to start at Y=0, the camera will clamp `scrollY` to 0 on tall displays, visually lifting the floor off the window bottom.

**Adding a gamepad one-shot action:** Always use `padJustDown(p, i)` (manual tracking), not Phaser's `justDown`. Then flush `_prevPadButtons` at the end of `update()`. Never add the new action inside the `if (isFrozen)` guard.

**Changing terrain amplitude at score 0:** `terrainAmplitude` starts at 0. Score-0 terrain is flat by design. Do not initialise it to a non-zero value unless you want the very first level to have hills.

**Palm trees call `getTerrainYAt()` and `getPlatformBounds()`:** Both require `this.terrainPoints` (set by `buildGround`) and `this.platforms` (set by `buildPlatforms`). `buildPalms()` must always be last in the build sequence.

---

## What Is Intentionally Out of Scope

The following are not present and should not be added without a deliberate scope decision:

- Audio (SFX, music, ambient)
- Crate destruction / debris
- Persistent storage (high scores, settings)
- Multiple scenes or a menu
- Enemy or NPC characters
- Mobile / touch controls
- Automated tests
