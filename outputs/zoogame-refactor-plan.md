# Project Canopy — Code Review & Refactor Plan

_June 2026_

**Executive Summary:** Project Canopy is a well-crafted browser game built on Phaser 3 / Matter.js. Core game-feel is excellent; the primary structural issue is a single 1,422-line scene class that accumulates every subsystem. This document identifies twelve code quality issues and presents a prioritised, incremental refactor plan.

---

## Contents

1. [Codebase Overview](#1-codebase-overview)
2. [Strengths](#2-strengths)
3. [Code Quality Issues](#3-code-quality-issues)
4. [Prioritised Refactor Plan](#4-prioritised-refactor-plan)
5. [Proposed Module Structure](#5-proposed-module-structure)
6. [Suggested Implementation Sequence](#6-suggested-implementation-sequence)
7. [Summary Scorecard](#7-summary-scorecard)

---

## 1. Codebase Overview

**Stack:** Phaser 3.80 (Canvas/WebGL), Matter.js physics (bundled), Vite 5.4 bundler, vanilla ES2020 JavaScript. No TypeScript, no UI framework, no external assets for game objects.

### 1.1 File Inventory

| File | Lines | Role | Quality |
|---|---|---|---|
| `src/main.js` | 26 | Game entry point — Phaser config | Excellent: minimal, correct |
| `src/scenes/PlaygroundScene.js` | 1,422 | World state, terrain, physics, scoring, UI, camera, decorations | Needs refactor: too large, mixes responsibilities |
| `src/objects/Elephant.js` | 305 | Player input, movement, animation | Good: well-structured, `update()` too long |
| `src/objects/TouchControls.js` | 255 | Mobile on-screen analog stick and buttons | Good: self-contained, minor duplication |
| `src/util/textures.js` | 236 | Runtime texture generation — all game art | Excellent: creative, efficient, consistent |
| `src/util/sounds.js` | 131 | Web Audio API synthesis — all sound effects | Good effects, hard to tune |

### 1.2 Architecture at a Glance

The game runs as a single Phaser scene. Initialization builds procedural terrain and platforms; the update loop drives input, movement, decorations and idle-detection every frame; Matter.js emits collision events that the scene routes to scoring, bouncing and kick logic.

| Subsystem | Where it lives |
|---|---|
| Game entry / Phaser config | `src/main.js` |
| Terrain generation & extension | `PlaygroundScene` — `buildGround()`, `generateChunkTerrainHeights()`, `extendWorld()` |
| Platform placement | `PlaygroundScene` — `buildPlatforms()`, `spawnPlatformCluster()`, `resolveOverlap()` |
| Scoring & world growth | `PlaygroundScene` — `onGoalScored()`, `restartLevel()`, `celebrateGoal()` |
| Physics collision dispatch | `PlaygroundScene` — `matter:collisionstart` listener |
| Camera & indicator arrows | `PlaygroundScene` — `create()` camera block, `updateIndicatorArrows()` |
| HUD & UI | `PlaygroundScene` — `scoreText`, `fruitIdleText`, controller dropdown |
| Decorations (clouds, birds, palms) | `PlaygroundScene` — `buildPalms()`, `updateClouds()`, `updateBirds()` |
| Player input & movement | `src/objects/Elephant.js` |
| Touch controls | `src/objects/TouchControls.js` |
| Procedural art | `src/util/textures.js` |
| Procedural audio | `src/util/sounds.js` |

---

## 2. Strengths

### 2.1 Procedural Art and Audio

All game visuals (platforms, fruit, goal, decorations, UI elements) are generated at runtime using the Phaser Graphics API. This eliminates an asset pipeline entirely, produces a consistent thick-outline aesthetic, and keeps the bundle small. The Web Audio synthesis in `sounds.js` layers four frequency bands to produce satisfying impact sounds with velocity-scaled volume.

### 2.2 Well-Named Constants

`PlaygroundScene` opens with approximately 50 named constants covering terrain shape, platform placement rules, physics feel and world growth rates. This means most tuning is a single-line edit at the top of the file rather than a buried literal.

### 2.3 Unified Input Abstraction

`Elephant.js` consolidates keyboard, gamepad and touch into a single normalised interface (`left`, `right`, `jumpJustPressed`, `dashHeld`). The gamepad "justDown" limitation in Phaser is worked around cleanly with a per-button state map. All three input paths are multi-touch-aware.

### 2.4 Label-Based Collision Dispatch

Every Matter body receives a `label` immediately after creation. The collision handler pattern-matches on these labels rather than holding object references, which makes the system robust to bodies being destroyed and re-created (as happens on every goal score).

### 2.5 Non-Destructive World Growth

When a goal is scored the world widens by 300 px and terrain amplitude increases by 15 px. The new chunk slides in smoothly from below while the existing terrain is preserved. This incremental approach avoids a jarring full-level restart while delivering a genuine difficulty ramp.

### 2.6 Smooth Terrain Seaming

Adjacent terrain chunks blend over 5 segments (~300 px) by locking wave phases across chunk boundaries and drifting wavelengths gradually toward new targets. The result is visually seamless despite being generated in independent calls.

---

## 3. Code Quality Issues

Twelve issues are identified below, grouped by theme. None are critical bugs; all are maintainability or extensibility concerns.

### 3.1 Monolithic Scene Class

> **PlaygroundScene.js is 1,422 lines and handles terrain generation, platform placement, physics collision dispatch, scoring, world growth, camera, HUD, decorations, and fruit idle detection simultaneously.**

This is the single largest structural problem. Every subsystem is a set of methods and instance variables on the same class, making it hard to:

- **navigate** — finding the platform spawner requires scrolling past terrain code and collision handlers
- **test** — any test of platform placement must construct a full scene
- **extend** — adding a new decoration type means editing the same file as physics tuning
- **reason about** — instance variable ownership is unclear (who owns `this.terrainPoints`?)

The recommended split is five manager classes, each with a single clear responsibility (see Section 4).

### 3.2 Fragile Goal-Scoring Timing Chain

> **Five independent visual events (score flash, GOAL! text, terrain slide, fruit respawn, crate rain) are sequenced with hardcoded millisecond delays. A change to one duration silently breaks the visual sequence.**

**Where:** `PlaygroundScene.onGoalScored()`, `celebrateGoal()` — approximately lines 295–390.

The terrain slide tween runs for 700 ms. Crate drops are staggered starting at 700 ms after the goal. If the tween duration is adjusted, the crates appear to fall at the wrong moment relative to the terrain. No callback or event links these two timings.

**Fix:** Use a Phaser tween `onComplete` callback or a simple event emitter so each stage starts only when the previous stage finishes, rather than relying on matching hardcoded numbers.

### 3.3 Dense Platform Overlap Resolution

> **`resolveOverlap()` is 55 lines of nested loops with no explanatory comments. The four-direction escape heuristic has no guaranteed convergence and silently returns the best-found position when the iteration limit is hit.**

**Where:** `PlaygroundScene.resolveOverlap()` — approximately lines 696–750.

The algorithm tries 20 random placements first, then falls back to 30 deterministic escape iterations. The escape directions (up, down, left, right) are calculated correctly but are completely undocumented. An edge case with many high-angle platforms on a small world could leave two platforms slightly overlapping.

**Fix:** Add a JSDoc comment explaining the two-phase approach, name the escape directions as constants, and add a guard that logs a warning and skips placement if the iteration limit is hit without convergence.

### 3.4 Magic Numbers in Non-Constant Locations

Most tuning values are correctly declared at the top of `PlaygroundScene`. However, several magic numbers appear embedded in method bodies:

| Issue | Location | Detail |
|---|---|---|
| Flash timing (120 ms, 1200 ms) | `PlaygroundScene` ~line 302 | Goal flash interval and total duration; not in constants block |
| GOAL! text style (`120px`, stroke 10) | `PlaygroundScene` ~line 319 | Font size and stroke hardcoded in tween definition |
| Palm spacing (560 px, jitter 90 px) | `PlaygroundScene` ~line 1047 | Decoration spacing not in top constants block |
| Bird flap interval (180 ms) | `PlaygroundScene` ~line 1145 | Defined inside `updateBirds()` instead of at top of file |
| Surface angle lerp (0.18) | `Elephant.js` ~line 287 | Unnamed lerp coefficient; effect unclear without experimentation |
| Gamepad button indices (0, 1, 2, 3) | `Elephant.js` ~lines 134–136 | Used as bare integers; comment lists mapping but not enforced |
| Bounce volume floor (0.05) | `sounds.js` line 11 | Silence threshold not a named constant |
| Noise buffer patterns | `sounds.js` lines 55–94 | Frequency and timing ramps entirely undocumented |

### 3.5 State Scattered Across Scene Fields

Related state for the same game concept is spread across many disconnected instance variables on `PlaygroundScene`:

| Concept | Scattered fields |
|---|---|
| Fruit | `this.fruit`, `this.fruitType`, `this.fruitIdleTime`, `this.fruitIdleText`, `fruitArrow` |
| Terrain | `this.terrainPoints`, `this.groundBodies`, `this.groundGraphicsObjects`, `terrainWaveState`, `terrainAmplitude` |
| Platforms | `this.platforms`, `this.platformArrows` |
| Score / World | `this.score`, `this.worldWidth`, `this.scoreText` |

Grouping these into dedicated manager objects (`FruitManager`, `TerrainManager`, etc.) would make ownership explicit and simplify `restartLevel()`, which currently must reset each field individually.

### 3.6 Input Dead-Zone Inconsistency

Three separate dead-zone values exist for three input paths, using different units and names: `STICK_DEAD = 0.2` (normalised, in `Elephant.js`), `STICK_DEAD_ZONE = 12` (pixels, in `TouchControls.js`). Keyboard is inherently digital. Adjusting feel for one path has no effect on the others, and the shared-looking names cause confusion about which unit is in use.

### 3.7 Collision Handler as a Monolithic Listener

All collision types are resolved inside one `matter:collisionstart` listener (~25 lines). Adding a new collision type requires editing this block and being careful not to break existing branches. A dispatch table mapping label pairs to handler functions would make additions safe and isolated.

### 3.8 Missing JSDoc on Complex Methods

The most complex methods in the codebase have no documentation:

- `generateChunkTerrainHeights()` — 90 lines of wave generation and blending
- `spawnPlatformCluster()` — recursive cluster spawner with depth decay
- `resolveOverlap()` — two-phase overlap resolution heuristic
- `updateBirds()` — frame-based wing animation state machine
- `bounceFruitOffPlatform()` — physics impulse calculation with platform angle

`Elephant.js` and `TouchControls.js` are better documented through variable names but still lack method-level docstrings. `sounds.js` has no documentation of frequency choices or timing rationale.

### 3.9 Wind Streak Rendering in Player Class

`Elephant.js` creates a `Phaser.GameObjects.Graphics` object and redraws it every frame during a dash. This is a visual effect, not gameplay logic, and its presence in the input/movement class blurs the class responsibility. It is also mildly inefficient — clear-and-redraw every frame at 60 FPS is fine for one effect but sets a precedent that does not scale.

### 3.10 Fragile postUpdate() Contract in TouchControls

`TouchControls.postUpdate()` must be called every frame to clear `jumpJustPressed`. If `PlaygroundScene` forgets this call, jump becomes permanently sticky. There is no mechanism to enforce the contract. An alternative is to expose a `consumeJump()` method that clears the flag when read, so the contract is impossible to accidentally violate.

### 3.11 Unused Dependency

`pngjs ^7.0.0` is listed in `package.json` devDependencies but is not imported anywhere in the codebase. It should be removed to keep the dependency list honest.

### 3.12 Missing Guard in getTerrainYAt()

`getTerrainYAt(x)` assumes `this.terrainPoints` is populated. If called before `buildGround()` — e.g., during an accidental early update tick — it will throw a silent runtime error. A one-line guard would surface this clearly.

---

## 4. Prioritised Refactor Plan

Work items are ordered by value-to-effort ratio. P1 items fix the largest structural problems. P2 items significantly improve day-to-day maintainability. P3 items are polish. P4 items are minor cleanups that can be done opportunistically.

> All refactors can be done incrementally. Each item is self-contained and can be merged independently. None require changing game behaviour.

| Priority | Item | Rationale | Effort | Impact |
|---|---|---|---|---|
| **P1** | Extract `TerrainManager` | `buildGround()`, `generateChunkTerrainHeights()`, `extendWorld()`, `getTerrainYAt()` and all terrain state move to a dedicated class. Largest single extraction; reduces `PlaygroundScene` by ~250 lines. | Medium | High |
| **P1** | Extract `PlatformSpawner` | `buildPlatforms()`, `spawnPlatformCluster()`, `getPlatformBounds()`, `resolveOverlap()` and platform state move out. Allows the overlap algorithm to be tested in isolation and documented properly. | Medium | High |
| **P1** | Fix goal-scoring timing chain | Replace hardcoded delay offsets with tween `onComplete` callbacks and a simple event sequence. Prevents visual desync when any tween duration is adjusted. | Small | Medium |
| **P2** | Extract `CollisionHandler` | Move the `collisionstart` listener to its own class with a label-pair dispatch table. New collision types become additive rather than requiring edits to an existing block. | Small | Medium |
| **P2** | Extract `UIManager` | `scoreText`, `fruitIdleText`, indicator arrows, controller dropdown, and GOAL! animation move to one class. `PlaygroundScene` stops owning display objects unrelated to physics. | Medium | Medium |
| **P2** | Extract `DecorationManager` | `buildPalms()`, `updateClouds()`, `updateBirds()` and decoration state move out. Decorations are entirely cosmetic; separating them means touching 0 gameplay code when tweaking visuals. | Small | Medium |
| **P2** | Add JSDoc to complex methods | `generateChunkTerrainHeights()`, `spawnPlatformCluster()`, `resolveOverlap()`, `bounceFruitOffPlatform()`, `updateBirds()`. Reduces onboarding time and makes intent clear before code is read. | Small | Medium |
| **P2** | Move remaining magic numbers to constants | Flash timings, GOAL! text style, palm spacing, bird flap interval, surface angle lerp, gamepad button indices. All tuning in one place; no need to grep method bodies. | Small | Low |
| **P3** | Consolidate input dead-zone handling | Single `STICK_DEAD_ZONE` constant shared across `TouchControls` and `Elephant`; documented unit (normalised). Tuning feel for analogue input becomes a one-variable change. | Small | Low |
| **P3** | Replace `postUpdate()` with `consumeJump()` | `TouchControls` exposes `consumeJump()` that returns the flag and clears it. Elephant calls it once per frame. Eliminates the "must call postUpdate every frame or jump sticks" footgun. | Small | Low |
| **P3** | Move wind-streak effect out of Elephant | Extract wind streak rendering to a `DashEffect` helper owned by the scene. `Elephant` becomes pure input/movement; visual effects can be changed without touching physics code. | Small | Low |
| **P3** | Add `sounds.js` constants and comments | Document frequency choices, name volume gains as constants, expose a master volume multiplier. Makes audio tuning approachable without Web Audio API expertise. | Small | Low |
| **P4** | Remove `pngjs` dependency | `npm uninstall pngjs` — it is imported nowhere. | Trivial | Low |
| **P4** | Guard `getTerrainYAt()` against missing points | One-line guard; surfaces initialisation-order bugs immediately instead of silently. | Trivial | Low |
| **P4** | Add `resolveOverlap()` convergence warning | `console.warn` when iteration limit is hit without convergence. Makes edge-case platform placement failures visible during development. | Trivial | Low |

---

## 5. Proposed Module Structure

After completing the P1 and P2 extractions, the source tree would look like this:

```
src/
  main.js                        (unchanged)
  scenes/
    PlaygroundScene.js           (~300 lines — orchestration only)
  objects/
    Elephant.js                  (unchanged)
    TouchControls.js             (unchanged)
  managers/
    TerrainManager.js            (terrain gen, bodies, graphics, queries)
    PlatformSpawner.js           (cluster spawn, overlap resolution)
    CollisionHandler.js          (dispatch table for physics events)
    UIManager.js                 (HUD, indicator arrows, GOAL! animation)
    DecorationManager.js         (clouds, birds, palms)
    FruitManager.js              (spawn, idle timer, respawn)
  util/
    textures.js                  (unchanged)
    sounds.js                    (constants added)
    constants.js                 (shared constants — dead zones, etc.)
```

`PlaygroundScene` becomes an orchestrator: it creates the managers, passes them to each other where needed (e.g., `CollisionHandler` receives `TerrainManager` and `FruitManager`), and calls their `update()` methods each frame. No gameplay logic lives in the scene itself.

---

## 6. Suggested Implementation Sequence

Each step below is independently mergeable and does not break existing behaviour.

| Step | Work |
|---|---|
| 1 | Remove `pngjs` (P4, trivial — good warm-up, confirms CI works) |
| 2 | Move remaining magic numbers to constants block in `PlaygroundScene` (P2) |
| 3 | Add JSDoc comments to the five undocumented complex methods (P2) |
| 4 | Add `sounds.js` constants and document frequency rationale (P3) |
| 5 | Fix goal-scoring timing chain with `onComplete` callbacks (P1) |
| 6 | Extract `TerrainManager` — copy methods, update all callers, delete originals (P1) |
| 7 | Extract `PlatformSpawner` (P1) |
| 8 | Extract `FruitManager` — fruit spawn, idle timer, respawn (P2) |
| 9 | Extract `CollisionHandler` with dispatch table (P2) |
| 10 | Extract `UIManager` — HUD, arrows, GOAL! animation (P2) |
| 11 | Extract `DecorationManager` — clouds, birds, palms (P2) |
| 12 | Consolidate dead-zone handling; replace `postUpdate()` with `consumeJump()` (P3) |
| 13 | Move wind-streak effect to `DashEffect` helper (P3) |
| 14 | Add `getTerrainYAt()` guard; add `resolveOverlap()` convergence warning (P4) |

> Steps 6–11 (the manager extractions) are the most time-consuming but can be done in any order. Each extraction can be verified by running the game and checking that feel, scoring, terrain growth and decorations are unchanged.

---

## 7. Summary Scorecard

| Dimension | Assessment |
|---|---|
| Correctness | No critical bugs found. Physics, scoring, and world growth logic are correct. |
| Code organisation | Needs work — one file handles eight distinct subsystems. |
| Naming | Good in constants and variables; gamepad button indices and dead-zone names are exceptions. |
| Documentation | Thin — complex algorithms have no JSDoc; `sounds.js` has no rationale comments. |
| Test coverage | None. All validation is manual in-browser. |
| Extensibility | Low for collisions and decorations; good for terrain tuning (constants-driven). |
| Dependencies | Minimal and appropriate; one unused package (`pngjs`) to remove. |
| Game feel | Excellent — physics tuning, procedural art, and audio are high quality. |
| Overall | Good prototype, needs structural refactor before the codebase grows further. |

---

**Bottom line:** Project Canopy has excellent game feel and a sound high-level architecture. The primary risk is that `PlaygroundScene` will become increasingly difficult to change as the game grows. The refactor plan above, completed in sequence, will reduce the scene to an orchestrator of well-defined managers, bring the codebase to a maintainable state, and make future feature development faster and less risky.
