# Project Canopy — Code Review & Refactor Plan

_June 2026 — Updated to reflect current codebase state_

**Executive Summary:** Project Canopy is a well-crafted browser game built on Phaser 3 / Matter.js. A major structural refactor has already decomposed the original 1,422-line monolithic scene class into six focused manager classes, reducing PlaygroundScene to a 390-line orchestrator. This document captures the full review, records completed work, identifies remaining opportunities, and prescribes red-green-refactor TDD as the methodology for all refactoring.

---

## Contents

1. [Codebase Overview](#1-codebase-overview)
2. [Strengths](#2-strengths)
3. [Code Quality Issues](#3-code-quality-issues)
4. [Red-Green-Refactor Methodology](#4-red-green-refactor-methodology)
5. [Prioritised Refactor Plan](#5-prioritised-refactor-plan)
6. [Implementation Sequence with TDD Cycles](#6-implementation-sequence-with-tdd-cycles)
7. [Proposed Module Structure](#7-proposed-module-structure)
8. [Summary Scorecard](#8-summary-scorecard)

---

## 1. Codebase Overview

**Stack:** Phaser 3.80 (Canvas/WebGL), Matter.js physics (bundled), Vite 5.4 bundler, vanilla ES2020 JavaScript. No TypeScript, no UI framework, no external assets for game objects.

**Test stack:** Vitest with Phaser mocked, 224 tests across 16 test files, BDD-style describe/scenario structure, mock helpers in `tests/helpers/mockScene.js`.

### 1.1 File Inventory

| File | Lines | Role | Quality |
|---|---|---|---|
| `src/main.js` | 26 | Game entry point — Phaser config | Excellent |
| `src/scenes/PlaygroundScene.js` | 390 | Scene orchestrator — delegates to managers | Good: focused on wiring |
| `src/managers/TerrainManager.js` | 361 | Terrain generation, bodies, graphics, queries | Good: well-documented |
| `src/managers/PlatformSpawner.js` | 434 | Cluster spawn, overlap resolution | Good: JSDoc on key methods |
| `src/managers/CollisionHandler.js` | 74 | Label-pair dispatch table for physics events | Excellent: clean, additive |
| `src/managers/UIManager.js` | 298 | HUD, indicator arrows, GOAL! animation | Good |
| `src/managers/DecorationManager.js` | 199 | Clouds, birds, palms | Good |
| `src/managers/FruitManager.js` | 113 | Fruit spawn, idle timer, respawn | Good |
| `src/objects/Elephant.js` | 327 | Player input, movement, animation | Good: `update()` still long |
| `src/objects/TouchControls.js` | 276 | Mobile on-screen analog stick and buttons | Good |
| `src/objects/DashEffect.js` | ~50 | Wind streak visual during dash | Good: isolated |
| `src/util/textures.js` | 235 | Runtime texture generation — all game art | Excellent |
| `src/util/sounds.js` | 176 | Web Audio API synthesis — all sound effects | Good: well-documented constants |
| `src/util/constants.js` | 21 | Shared constants (world dimensions, terrain params) | Good |

### 1.2 Architecture at a Glance

PlaygroundScene acts as an orchestrator. It creates managers in `create()`, wires them together, and calls their `update()` methods each frame. No gameplay logic lives in the scene itself.

| Subsystem | Owner |
|---|---|
| Terrain generation & queries | `TerrainManager` |
| Platform placement & overlap | `PlatformSpawner` |
| Physics collision dispatch | `CollisionHandler` |
| HUD, arrows, GOAL! animation | `UIManager` |
| Clouds, birds, palms | `DecorationManager` |
| Fruit spawn, idle, respawn | `FruitManager` |
| Player input & movement | `Elephant` |
| Touch input | `TouchControls` |
| Dash visual effect | `DashEffect` |
| Procedural art | `textures.js` |
| Procedural audio | `SoundManager` (`sounds.js`) |

### 1.3 Test Inventory

| Test File | Covers |
|---|---|
| `terrain.test.js` | `getTerrainYAt()` interpolation, clamping; `minTerrainYInRange()` |
| `platforms.test.js` | `getPlatformBounds()` AABB at angles; `platformOverlapAmount()` |
| `movement.test.js` | Horizontal movement speeds, ground vs air, friction deceleration |
| `jumping.test.js` | Jump velocity, double jump, air jump reset on landing |
| `dash.test.js` | Dash speed, direction, animation speed |
| `fruit-kicking.test.js` | Kick impulse direction, speed scaling |
| `fruit-physics.test.js` | Platform bounce boost, wall bounce, angular velocity flip |
| `fruit-idle.test.js` | Idle timer accumulation, countdown text, respawn trigger |
| `crate.test.js` | Crate explosion on dash, debris spawn |
| `scoring.test.js` | Score increment, text update, fruit destroy/respawn, crate rain, flash |
| `world-expansion.test.js` | Width growth, terrain amplitude increase, platform/palm rebuild |
| `level-restart.test.js` | Terrain rebuild, fruit/crate respawn, elephant reset |
| `touch-controls.test.js` | Pointer routing, consumeJump(), button press/release |
| `background.test.js` | Cloud creation, bird creation, palm placement |
| `hud.test.js` | Score text, indicator arrows, GOAL! animation |

---

## 2. Strengths

### 2.1 Procedural Art and Audio

All game visuals are generated at runtime using the Phaser Graphics API. The Web Audio synthesis in `sounds.js` layers four frequency bands with comprehensively documented constants.

### 2.2 Well-Named Constants

Constants are declared at the top of each module. Shared constants live in `constants.js`. Gamepad button indices are named (`PAD_BTN_CROSS`, `PAD_BTN_SQUARE`, etc.). Lerp coefficients and dead zones are named and documented.

### 2.3 Unified Input Abstraction

`Elephant.js` consolidates keyboard, gamepad and touch into a single normalised interface. The gamepad "justDown" limitation in Phaser is worked around with a per-button state map.

### 2.4 Label-Based Collision Dispatch

`CollisionHandler` uses a dispatch table mapping label pairs to handler functions. New collision types are additive — add an entry to `_handlers`, no existing code changes.

### 2.5 Clean Manager Decomposition

The six extracted managers each own their state and operations. `PlaygroundScene` is a 390-line orchestrator. Each manager can be tested in isolation with mock scenes.

### 2.6 Comprehensive Test Suite

224 tests across 16 files cover terrain, platforms, movement, jumping, dashing, fruit physics, scoring, world expansion, level restart, touch controls, decorations, and HUD. All tests use BDD-style describe/scenario structure.

---

## 3. Code Quality Issues

### 3.1 Completed Fixes

The following issues from the original review have been resolved:

| Issue | Resolution |
|---|---|
| Monolithic PlaygroundScene (1,422 lines) | Decomposed into 6 managers; scene is now 390 lines |
| Fragile goal-scoring timing chain | Terrain tween uses `onComplete` callback to sequence goal slide |
| Dense undocumented platform overlap | JSDoc added; convergence warning on iteration limit |
| Magic numbers in method bodies | Named constants throughout: gamepad buttons, lerp, dead zones, sound params |
| State scattered across scene fields | Grouped into manager classes with explicit ownership |
| Collision handler as monolithic listener | Dispatch table in `CollisionHandler` |
| Missing JSDoc on complex methods | 43 JSDoc comments across 9 files |
| Wind streak in player class | Extracted to `DashEffect` |
| Fragile `postUpdate()` contract | Replaced with `consumeJump()` |
| Unused `pngjs` dependency | Removed |
| Missing guard in `getTerrainYAt()` | Guard added: `!this.terrainPoints?.length` |
| `resolveOverlap()` convergence | `console.warn` on iteration limit |
| Sound constants undocumented | Comprehensive named constants with rationale comments |

### 3.2 Remaining Issues

**3.2.1 Elephant.update() is still 130+ lines**

`Elephant.update()` handles input polling, movement decisions, jump logic, fall cap, landing stomp, and animation selection in one method. It would benefit from splitting into `updateInput()`, `updateMovement()`, and `updateAnimation()` — each independently testable.

**3.2.2 Noise buffer creation is duplicated in sounds.js**

Lines 101–103, 119–121, and 137–139 repeat the same pattern: `createBuffer` → `getChannelData` → fill with `Math.random() * 2 - 1`. A `createNoiseBuffer(duration)` helper would eliminate the duplication.

**3.2.3 Crate management split across PlaygroundScene and CollisionHandler**

`addCrate()` and `explodeCrate()` live on `PlaygroundScene`, while crate collision logic lives in `Elephant.onCollisionStart()`. A `CrateManager` would group crate lifecycle (spawn, explode, cleanup) and make crate-related tests self-contained.

**3.2.4 Colour palette not centralised**

Outline colour `0x1a1a1a`, fruit colours, and button colours are spread across `textures.js`, `TouchControls.js`, and `DecorationManager.js`. A shared palette would make theming a single-file change.

**3.2.5 Sky gradient drawn inline in PlaygroundScene.create()**

The 20-line sky gradient rendering (lines 75–98) is visual decoration that belongs in `DecorationManager`, consistent with where clouds, birds, and palms already live.

**3.2.6 No createNoiseBuffer helper in sounds.js**

Three identical noise-buffer creation blocks could share a helper.

---

## 4. Red-Green-Refactor Methodology

Every refactoring step follows the red-green-refactor TDD cycle. This ensures that behaviour is locked in by tests before any structural change, and that the refactor itself cannot silently break functionality.

### The Cycle

```
┌─────────────────────────────────────────────────────────┐
│                                                         │
│   RED ──────► GREEN ──────► REFACTOR ──────► RED ...    │
│                                                         │
│   Write a      Make it      Restructure     Next        │
│   failing      pass with    the code        behaviour   │
│   test         minimal      while keeping                │
│                code         tests green                  │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

**RED — Write a failing test first**
- The test describes the _behaviour_ the refactored code must preserve or introduce.
- Import the _new_ module (e.g., `CrateManager`) or the _new_ method (e.g., `Elephant.updateMovement()`). The import fails or the method doesn't exist — the test is red.
- The test should be as specific as possible: assert on return values, state changes, or mock call counts — not "it doesn't throw."
- For extraction refactors, the test is a _characterisation test_: it captures the existing behaviour of the code that will be moved, written against the new interface that doesn't exist yet.

**GREEN — Make the test pass with minimal code**
- Create the new file/class/method.
- Move or copy the code that satisfies the test.
- Do _not_ clean up, rename, or restructure beyond what the test requires.
- Run the full test suite — all 224+ tests must pass, not just the new one.

**REFACTOR — Improve structure while green**
- Now clean up: remove duplication between old and new locations, rename for clarity, extract helpers, delete dead code in the original file.
- After each change, run the full suite. If anything goes red, undo the last change and investigate.
- This is also the time to update `AGENTS.md` and `docs/USE_CASES.md` to reflect the new structure.

### Rules

1. **Never refactor while red.** If the new test is failing, focus only on making it pass. Resist the urge to "also fix that thing while you're in there."
2. **One behaviour per cycle.** Each red-green-refactor cycle should cover one testable behaviour. An extraction refactor may need several cycles (one per public method being moved).
3. **Commit at green.** After every green step, commit. The refactor step gets its own commit. This means each refactor produces at least two commits: one for the new tests + minimal code (green), one for the structural cleanup (refactor).
4. **Existing tests are the safety net.** The 224 existing tests must stay green throughout. They catch regressions that the new characterisation tests might not cover.
5. **Run the game after each refactor commit.** Tests verify code correctness; playing the game verifies _feel_. Physics tuning, animation timing, and input responsiveness can regress in ways unit tests don't catch.

---

## 5. Prioritised Refactor Plan

### 5.1 Completed Items

| Priority | Item | Status |
|---|---|---|
| **P1** | Extract `TerrainManager` | Done |
| **P1** | Extract `PlatformSpawner` | Done |
| **P1** | Fix goal-scoring timing chain | Done |
| **P2** | Extract `CollisionHandler` | Done |
| **P2** | Extract `UIManager` | Done |
| **P2** | Extract `DecorationManager` | Done |
| **P2** | Add JSDoc to complex methods | Done |
| **P2** | Move remaining magic numbers to constants | Done |
| **P3** | Consolidate input dead-zone handling | Done (documented; intentionally separate units) |
| **P3** | Replace `postUpdate()` with `consumeJump()` | Done |
| **P3** | Move wind-streak effect out of Elephant | Done (`DashEffect`) |
| **P3** | Add `sounds.js` constants and comments | Done |
| **P4** | Remove `pngjs` dependency | Done |
| **P4** | Guard `getTerrainYAt()` | Done |
| **P4** | Add `resolveOverlap()` convergence warning | Done |

### 5.2 Remaining Items

| Priority | Item | Rationale | Effort | Impact |
|---|---|---|---|---|
| **P2** | Split `Elephant.update()` | 130+ line method doing input, movement, jump, stomp, animation. Split into `updateInput()`, `updateMovement()`, `updateAnimation()` — each independently testable. | Medium | Medium |
| **P2** | Extract `CrateManager` | `addCrate()`, `explodeCrate()`, crate array management, and crate rain logic currently on PlaygroundScene. Grouping them enables isolated crate lifecycle tests. | Medium | Medium |
| **P3** | Extract `createNoiseBuffer()` helper in sounds.js | Three identical noise-buffer creation blocks. A shared helper eliminates duplication. | Small | Low |
| **P3** | Move sky gradient to `DecorationManager` | 20 lines of visual rendering in `PlaygroundScene.create()` belongs with other decorations. | Small | Low |
| **P3** | Centralise colour palette | Outline, fruit, and button colours scattered across files. A `palette.js` would make theming a single-file change. | Small | Low |

---

## 6. Implementation Sequence with TDD Cycles

Each step below details the red-green-refactor cycle. Steps are independently mergeable.

---

### Step 1: Split `Elephant.update()` into sub-methods (P2)

The 130-line `update()` method handles input polling, movement application, jump/stomp logic, and animation selection. Splitting it makes each concern independently testable.

#### Cycle 1a: Extract `updateMovement()`

**RED** — Write `tests/elephant-movement-split.test.js`:
```js
import Elephant from '../src/objects/Elephant.js';

it('updateMovement applies ground speed when grounded and moving right', () => {
  const elephant = makeElephant({ groundContacts: 1 });
  elephant.updateMovement({ left: false, right: true, dashHeld: false });
  expect(elephant.sprite.setVelocityX).toHaveBeenCalledWith(4.5);
});

it('updateMovement applies air speed when airborne', () => {
  const elephant = makeElephant({ groundContacts: 0 });
  elephant.updateMovement({ left: false, right: true, dashHeld: false });
  expect(elephant.sprite.setVelocityX).toHaveBeenCalledWith(3.2);
});

it('updateMovement applies dash speed when dashing', () => {
  const elephant = makeElephant({ groundContacts: 1, facing: 1 });
  elephant.updateMovement({ left: false, right: true, dashHeld: true });
  expect(elephant.sprite.setVelocityX).toHaveBeenCalledWith(9);
});
```
These fail because `updateMovement()` doesn't exist on Elephant.

**GREEN** — Extract the movement block from `update()` into a new `updateMovement(input)` method. Call it from `update()`. Run full suite — all 224+ tests pass.

**REFACTOR** — Remove duplicated inline movement code from `update()`. Ensure `update()` calls `this.updateMovement(input)` where `input` is the normalised input object built earlier in the method. Commit.

#### Cycle 1b: Extract `updateAnimation()`

**RED** — Add tests:
```js
it('updateAnimation plays jump-up when airborne and rising', () => {
  const elephant = makeElephant({ groundContacts: 0 });
  elephant.sprite.body.velocity.y = -5;
  elephant.updateAnimation({ left: false, right: false, dashHeld: false });
  expect(elephant.sprite.play).toHaveBeenCalledWith('elephant-jump-up', true);
});

it('updateAnimation plays run when moving horizontally on ground', () => {
  const elephant = makeElephant({ groundContacts: 1 });
  elephant.updateAnimation({ left: true, right: false, dashHeld: false });
  expect(elephant.sprite.play).toHaveBeenCalledWith('elephant-run', true);
});
```
These fail because `updateAnimation()` doesn't exist.

**GREEN** — Extract the animation selection block into `updateAnimation(input)`. Run full suite.

**REFACTOR** — `update()` is now a short orchestrator: build input → `updateMovement(input)` → jump/stomp → `updateAnimation(input)` → visuals → dash effect. Clean up any dead local variables. Commit.

---

### Step 2: Extract `CrateManager` (P2)

Crate lifecycle is currently split between `PlaygroundScene` (`addCrate`, `explodeCrate`, `this.crates` array) and `Elephant.onCollisionStart` (dash-explosion trigger). A `CrateManager` would own spawn, explode, cleanup, and the crate rain logic from `onGoalScored`.

#### Cycle 2a: Test crate spawning

**RED** — Write `tests/crate-manager.test.js`:
```js
import CrateManager from '../src/managers/CrateManager.js';

it('addCrate creates a matter image with label "crate"', () => {
  const manager = makeCrateManager();
  const crate = manager.addCrate(100, 200);
  expect(crate.body.label).toBe('crate');
});

it('tracks spawned crates in crates array', () => {
  const manager = makeCrateManager();
  manager.addCrate(100, 200);
  manager.addCrate(300, 200);
  expect(manager.crates).toHaveLength(2);
});
```
Fails — `CrateManager` doesn't exist.

**GREEN** — Create `src/managers/CrateManager.js` with `addCrate()`. Move the body from `PlaygroundScene.addCrate()`. Run full suite.

**REFACTOR** — Update `PlaygroundScene` to use `this.crateManager.addCrate()` instead of `this.addCrate()`. Delete `PlaygroundScene.addCrate()`. Commit.

#### Cycle 2b: Test crate explosion

**RED** — Add tests:
```js
it('explodeCrate destroys the crate and removes it from tracking', () => {
  const manager = makeCrateManager();
  const crate = manager.addCrate(100, 200);
  manager.explodeCrate(crate);
  expect(crate.destroy).toHaveBeenCalled();
  expect(manager.crates).toHaveLength(0);
});

it('explodeCrate spawns 10 debris particles', () => {
  const manager = makeCrateManager();
  const crate = manager.addCrate(100, 200);
  manager.explodeCrate(crate);
  expect(manager.scene.add.rectangle).toHaveBeenCalledTimes(10);
});
```

**GREEN** — Move `explodeCrate()` from `PlaygroundScene` to `CrateManager`. Run full suite.

**REFACTOR** — Update `Elephant.onCollisionStart` to call `this.scene.crateManager.explodeCrate()`. Update `PlaygroundScene.onGoalScored` crate rain to use `this.crateManager.addCrate()`. Remove crate methods from `PlaygroundScene`. Commit.

#### Cycle 2c: Test crate rain

**RED** — Add test:
```js
it('dropCrateRain schedules N staggered crate drops', () => {
  const manager = makeCrateManager();
  manager.dropCrateRain(3, 1700); // 3 crates, starting at 1700ms
  expect(manager.scene.time.delayedCall).toHaveBeenCalledTimes(3);
});
```

**GREEN** — Extract the crate rain loop from `onGoalScored` into `CrateManager.dropCrateRain(count, startDelay)`.

**REFACTOR** — `onGoalScored` now calls `this.crateManager.dropCrateRain(this.score, FRUIT_RESPAWN_DELAY)`. Clean up. Commit.

---

### Step 3: Extract `createNoiseBuffer()` helper in sounds.js (P3)

#### Single cycle

**RED** — Write `tests/sounds.test.js`:
```js
import { createNoiseBuffer } from '../src/util/sounds.js';

it('creates a buffer of the requested duration', () => {
  const ctx = new OfflineAudioContext(1, 44100, 44100);
  const buf = createNoiseBuffer(ctx, 0.5);
  expect(buf.duration).toBeCloseTo(0.5, 1);
});

it('fills the buffer with values in [-1, 1]', () => {
  const ctx = new OfflineAudioContext(1, 44100, 44100);
  const buf = createNoiseBuffer(ctx, 0.1);
  const data = buf.getChannelData(0);
  for (let i = 0; i < data.length; i++) {
    expect(data[i]).toBeGreaterThanOrEqual(-1);
    expect(data[i]).toBeLessThanOrEqual(1);
  }
});
```
Fails — `createNoiseBuffer` is not exported.

**GREEN** — Add the exported function. Run full suite.

**REFACTOR** — Replace the three inline noise buffer blocks in `playCrateBreak()` with calls to `createNoiseBuffer()`. Run suite. Commit.

---

### Step 4: Move sky gradient to `DecorationManager` (P3)

#### Single cycle

**RED** — Add to `tests/background.test.js`:
```js
it('createSkyGradient draws gradient bands to a graphics object', () => {
  const decorations = makeDecorationManager();
  decorations.createSkyGradient();
  expect(decorations.scene.add.graphics).toHaveBeenCalled();
});
```
Fails — `createSkyGradient()` doesn't exist on `DecorationManager`.

**GREEN** — Move the sky gradient block from `PlaygroundScene.create()` into `DecorationManager.createSkyGradient()`. Call it from `PlaygroundScene.create()`. Run full suite.

**REFACTOR** — Delete the inline gradient code from `PlaygroundScene.create()`. Commit.

---

### Step 5: Centralise colour palette (P3)

#### Single cycle

**RED** — Write `tests/palette.test.js`:
```js
import { PALETTE } from '../src/util/palette.js';

it('exports outline colour', () => {
  expect(PALETTE.outline).toBe(0x1a1a1a);
});

it('exports fruit colours', () => {
  expect(PALETTE.orange).toBeDefined();
  expect(PALETTE.apple).toBeDefined();
  expect(PALETTE.melon).toBeDefined();
});
```
Fails — `palette.js` doesn't exist.

**GREEN** — Create `src/util/palette.js` exporting the colour constants. Run full suite.

**REFACTOR** — Update `textures.js`, `TouchControls.js`, `DecorationManager.js`, and `constants.js` to import from `palette.js` instead of defining colours inline. Delete the old inline colour definitions. Run full suite after each file. Commit.

---

## 7. Proposed Module Structure

After completing the remaining items, the source tree would be:

```
src/
  main.js                        (unchanged)
  scenes/
    PlaygroundScene.js           (~350 lines — orchestration only)
  objects/
    Elephant.js                  (update split into sub-methods)
    TouchControls.js             (unchanged)
    DashEffect.js                (unchanged)
  managers/
    TerrainManager.js            (terrain gen, bodies, graphics, queries)
    PlatformSpawner.js           (cluster spawn, overlap resolution)
    CollisionHandler.js          (dispatch table for physics events)
    UIManager.js                 (HUD, indicator arrows, GOAL! animation)
    DecorationManager.js         (clouds, birds, palms, sky gradient)
    FruitManager.js              (spawn, idle timer, respawn)
    CrateManager.js              (spawn, explode, cleanup, crate rain)
  util/
    textures.js                  (unchanged)
    sounds.js                    (with createNoiseBuffer helper)
    constants.js                 (shared constants)
    palette.js                   (centralised colour definitions)
tests/
  terrain.test.js
  platforms.test.js
  movement.test.js
  jumping.test.js
  dash.test.js
  fruit-kicking.test.js
  fruit-physics.test.js
  fruit-idle.test.js
  crate.test.js
  crate-manager.test.js          (new)
  scoring.test.js
  world-expansion.test.js
  level-restart.test.js
  touch-controls.test.js
  background.test.js
  hud.test.js
  sounds.test.js                 (new)
  palette.test.js                (new)
  helpers/
    mockScene.js
```

---

## 8. Summary Scorecard

| Dimension | Assessment |
|---|---|
| Correctness | No bugs found. Physics, scoring, and world growth logic are correct. |
| Code organisation | Strong — 6 managers extracted, scene is an orchestrator. Minor opportunities remain (CrateManager, Elephant split). |
| Naming | Good throughout. Constants named, gamepad buttons named, dead zones documented. |
| Documentation | Good — 43 JSDoc comments, comprehensive AGENTS.md, BDD use cases. |
| Test coverage | Strong — 224 tests across 16 files covering all major subsystems. |
| Extensibility | Good — collision dispatch is additive, managers are independent, terrain is parameterised. |
| Dependencies | Minimal and clean — Phaser only. |
| Game feel | Excellent — physics tuning, procedural art, and audio are high quality. |
| Overall | Well-structured codebase with a solid test suite. Remaining refactors are polish, not structural. |

---

**Bottom line:** The major structural refactor is complete. PlaygroundScene is a 390-line orchestrator backed by six focused managers and 224 tests. The remaining five items are polish-level improvements that follow the same red-green-refactor methodology used for the completed work. Each produces a small, independently mergeable commit that expands test coverage while improving code organisation.
