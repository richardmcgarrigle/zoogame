# Project Canopy — BDD Use Cases

> **Keep this file current.** Whenever code changes affect player mechanics, controls, physics, scoring, UI, or any other observable behavior, update the relevant scenarios here as part of the same commit.

---

## Feature: Player Movement

**Scenario: Walk right on flat ground**
- Given the elephant is standing on flat ground
- When the player holds the right arrow key, D key, right D-pad, right gamepad stick, or right touch stick
- Then the elephant moves right at 4.5 px/frame

**Scenario: Walk left on flat ground**
- Given the elephant is standing on flat ground
- When the player holds the left arrow key, A key, left D-pad, left gamepad stick, or left touch stick
- Then the elephant moves left at 4.5 px/frame

**Scenario: Reduced air control while airborne**
- Given the elephant is in the air
- When the player holds a horizontal movement input
- Then the elephant moves at 3.2 px/frame (reduced from grounded 4.5)

**Scenario: Elephant faces the direction of travel**
- Given the elephant is moving
- When the player changes direction
- Then the elephant sprite flips horizontally to face the new direction

**Scenario: Elephant tilts to match slope**
- Given the elephant is standing on a sloped surface
- When the elephant lands or walks onto a slope
- Then the elephant sprite smoothly rotates to match the surface angle (clamped ±35°, lerp 0.18/frame)

**Scenario: Elephant is stationary**
- Given no movement input is held
- When the elephant is on the ground
- Then the elephant plays the idle animation

---

## Feature: Jumping

**Scenario: Jump from ground**
- Given the elephant is on the ground (groundContacts > 0)
- When the player presses Up arrow, W key, gamepad Cross/D-pad-up, or touch jump button
- Then the elephant launches upward at -11 px/frame vertical velocity

**Scenario: Double jump**
- Given the elephant is airborne and has not yet used a mid-air jump
- When the player presses the jump input
- Then the elephant launches upward at -11 px/frame vertical velocity (same as ground jump)
- And the mid-air jump is consumed (no further air jumps until grounded again)

**Scenario: Cannot jump a third time while airborne**
- Given the elephant is airborne and has already used one mid-air jump
- When the player presses the jump input
- Then no jump occurs

**Scenario: Ascending animation**
- Given the elephant is airborne and moving upward (velocity.y < -1)
- Then the elephant displays the jump-up sprite frame

**Scenario: Descending animation**
- Given the elephant is airborne and falling (velocity.y > 2)
- Then the elephant displays the jump-down sprite frame

**Scenario: Fall velocity capped**
- Given the elephant is falling
- When downward velocity would exceed 11 px/frame
- Then velocity is clamped to 11 px/frame

**Scenario: Hard landing stomp**
- Given the elephant was falling faster than 7 px/frame
- When the elephant lands on a surface
- Then the camera shakes for 140ms, the elephant sprite squash-stretches, and a thud sound plays

---

## Feature: Dash

**Scenario: Dash while grounded**
- Given the elephant is on the ground
- When the player holds Space, Shift, gamepad Square, or touch dash button
- Then the elephant dashes at 9 px/frame in the direction it is facing

**Scenario: Dash while airborne**
- Given the elephant is in the air
- When the player holds the dash input
- Then the elephant dashes at 9 px/frame horizontally in the direction it is facing

**Scenario: Dash ends when input released**
- Given the elephant is dashing
- When the player releases the dash input
- Then the dash stops and normal movement resumes

**Scenario: Wind streaks appear while dashing**
- Given the elephant is dashing
- Then 3 wind streak particles spawn per frame, travel opposite to dash direction, and fade over 260ms

**Scenario: Run animation accelerates while dashing**
- Given the elephant is dashing
- Then the run animation plays at 2.5× normal speed

---

## Feature: Fruit Kicking

**Scenario: Elephant kicks fruit on collision**
- Given the elephant collides with a fruit
- Then the fruit receives a kick impulse in the direction away from the elephant, scaled by the elephant's velocity (minimum 0.5 px/frame, multiplied by 1.6)

**Scenario: Fruit receives spin on kick**
- Given the elephant kicks a fruit
- Then the fruit receives ±0.25 rad/frame angular velocity matching the kick direction

**Scenario: Fruit receives upward boost on kick**
- Given the elephant kicks a fruit
- Then the fruit receives an upward component: min(elephant.velocityY, 0) − 2.5 − random[0, 1.5]

**Scenario: Melon is heavier and harder to kick far**
- Given a melon (density 0.0010) vs an orange or apple (density 0.0006)
- When kicked with the same elephant velocity
- Then the melon travels a shorter distance due to higher mass

---

## Feature: Fruit Physics & Respawn

**Scenario: Fruit bounces off terrain**
- Given a fruit is in flight
- When it contacts the ground or a platform
- Then it bounces with restitution 0.75

**Scenario: Fruit bounces off wall**
- Given a fruit reaches the left or right world boundary
- When it contacts the wall
- Then its X velocity is negated and clamped to a minimum of 4 px/frame, a spring sound plays, and its angular velocity is negated

**Scenario: Fruit amplified bounce off platform**
- Given a fruit contacts a leaf platform
- Then it receives an amplified bounce impulse (minimum 5 px/frame away from platform, boost factor 1.5)

**Scenario: Idle fruit warning**
- Given the fruit's speed has been below 0.8 px/frame for 5 seconds
- Then a warning message appears: "Ball stuck — respawning in Xs"

**Scenario: Idle fruit auto-respawn**
- Given the fruit's speed has been below 0.8 px/frame for 10 seconds
- Then the fruit is destroyed and respawned at a random X position, launched from the top of the screen at a random angle and speed (4–12 px/frame) with spin

**Scenario: Fruit respawns after goal**
- Given a goal has just been scored
- When 1700ms have elapsed
- Then a new fruit spawns at a random X within the world and falls from the top

**Scenario: Fruit stays within world bounds**
- Given the fruit is in play
- When it escapes the world bounds (below or outside)
- Then it is respawned at a valid position

---

## Feature: Crate

**Scenario: Crate spawns on scene start**
- Given the scene has just loaded
- Then one crate appears at (950, 850)

**Scenario: Crates spawn after each goal**
- Given the score is N after a goal
- Then N crates drop from the top of the screen at 1700 + i×200ms intervals with random X positions and initial velocities

**Scenario: Elephant dash destroys crate**
- Given the elephant is dashing
- When the elephant collides with a crate
- Then the crate explodes: 10 debris rectangles fly outward, a yellow flash ring expands, and a crate-break sound plays

**Scenario: Normal (non-dash) collision with crate**
- Given the elephant is not dashing
- When the elephant touches a crate
- Then the crate is kicked like any physics body (no explosion)

---

## Feature: Goal Scoring

**Scenario: Score a goal**
- Given the fruit is in play
- When the fruit contacts the goal sensor
- Then the score increments by 1, a "GOAL!" overlay appears, and the fruit is destroyed

**Scenario: GOAL! overlay animation**
- Given a goal has been scored
- Then "GOAL!" text scales from 0.5 to 1 in 250ms, holds for 700ms, then scales to 1.3 and fades out in 400ms

**Scenario: Score display flashes**
- Given a goal has been scored
- Then the score text flashes on/off at 120ms intervals for 10 cycles (0.6 seconds total)

**Scenario: Elephant celebrate animation**
- Given a goal has been scored
- Then the elephant displays the celebrate sprite frame

**Scenario: Goal stars celebration**
- Given a goal has been scored
- Then 12 star particles radiate outward from the goal

---

## Feature: World Expansion & Difficulty Scaling

**Scenario: World widens on each goal**
- Given a goal has been scored
- Then the world width increases by 300px

**Scenario: Terrain amplitude increases with score**
- Given the current score is N
- Then terrain amplitude is min(N × 15, 180) pixels

**Scenario: New terrain extends smoothly**
- Given the world just widened
- Then new terrain is generated for the new chunk, blending smoothly from the previous edge, and animates up from 600px below over 700ms

**Scenario: New platforms spawn in expanded chunk**
- Given the world just widened
- Then platforms are generated for the new chunk using the cluster algorithm and animate in over 600ms

**Scenario: New palm trees appear in expanded chunk**
- Given the world just widened
- Then palm trees are placed in the new chunk and slide in from below over 700ms

**Scenario: Goal repositions to new world edge**
- Given the world just widened
- Then the goal slides horizontally to worldWidth − 100 over 900ms (with 700ms delay)

**Scenario: Platform angle increases with score**
- Given the current score is N
- Then platforms spawn at angles ±min(N × 2, 25)° (minimum 8°)

**Scenario: Platform cluster density increases with score**
- Given the current score is N
- Then cluster spawn chance is min(0.35 + N × 0.025, 0.65)

---

## Feature: Level Restart

**Scenario: Restart preserves score**
- Given the player presses R
- Then the terrain, platforms, fruit, crate, and elephant position reset, but the score is unchanged

**Scenario: Restart resets elephant position**
- Given the player presses R
- Then the elephant is repositioned to (180, 800) with zero velocity

**Scenario: Restart generates new terrain**
- Given the player presses R
- Then new random wave parameters are chosen and terrain is regenerated

---

## Feature: Platforms

**Scenario: Platform cluster spawning**
- Given a new chunk of world is generated
- Then platforms are placed using a cluster algorithm with hierarchical branching (up to 4 levels deep)

**Scenario: Platforms clear the ground**
- Given a platform is placed
- Then it is positioned at least 110px above the terrain surface at that X so the elephant can walk underneath

**Scenario: Platforms do not overlap**
- Given two platforms are placed near each other
- Then they maintain at least a 12px gap or are separated vertically

---

## Feature: Background Environment

**Scenario: Clouds drift across the viewport**
- Given the game is running
- Then 6 clouds drift slowly at speeds 11–20 px/sec with scroll factor 0 (viewport-fixed)

**Scenario: Birds fly and bob**
- Given the game is running
- Then 5 toucans fly horizontally at 60–140 px/sec, bob vertically ±8px, alternate flap frames every 180ms, and wrap when they exit the screen

**Scenario: Bird nudges fruit**
- Given a toucan is within 44px of the fruit
- Then it imparts an impulse (±9 X, −5 Y) on the fruit and enters a 1200ms cooldown

**Scenario: Palm trees populate the terrain**
- Given a world chunk is generated
- Then palm trees are placed approximately every 560px along the terrain, avoiding areas occupied by platforms

---

## Feature: HUD & UI

**Scenario: Score displayed**
- Given the game is running
- Then the current score is shown in the top-right corner in bold monospace text

**Scenario: Off-screen fruit arrow**
- Given the fruit is off the visible screen area
- Then an orange arrow on the screen edge points toward the fruit's position

**Scenario: Off-screen goal arrow**
- Given the goal is off the visible screen area
- Then a white arrow on the screen edge points toward the goal's position

**Scenario: Arrows hidden when target is on screen**
- Given the fruit or goal is visible within the camera viewport
- Then the corresponding indicator arrow is hidden

**Scenario: Arrows flash alternately**
- Given both arrows are visible
- Then the higher-priority arrow (fruit > goal) flashes between alpha 1.0 and 0.1 every 600ms; the other stays at alpha 1.0

**Scenario: Control hints displayed**
- Given the game is running
- Then keyboard control hints are shown in the top-left corner

---

## Feature: Gamepad Support

**Scenario: Gamepad connected and shown in dropdown**
- Given a gamepad is connected
- Then it appears by name in the controller dropdown at the top of the screen

**Scenario: Specific gamepad selected**
- Given a gamepad is selected from the dropdown
- Then only input from that gamepad is accepted

**Scenario: Auto (all) mode**
- Given "Auto (all)" is selected in the dropdown
- Then input is accepted from any connected gamepad

**Scenario: Gamepad disconnect updates dropdown**
- Given a gamepad disconnects
- Then it is removed from the dropdown

---

## Feature: Touch Controls

**Scenario: Analog stick appears at touch origin**
- Given the player touches or clicks anywhere on the screen (that is not a button)
- Then an analog stick base and thumb appear at the touch point

**Scenario: Analog stick controls movement**
- Given the touch is displaced more than 12px left or right from the stick base
- Then the elephant moves in that direction

**Scenario: Stick dead zone prevents drift**
- Given the touch thumb is within 12px of the stick base
- Then no horizontal movement is registered

**Scenario: Stick dash zone activates dash**
- Given the touch is displaced 56px or more from the stick base
- Then the elephant dashes (dashHeld is true) for as long as the drag remains in the outer zone
- And the stick thumb turns orange to indicate dash mode

**Scenario: Stick returns to walk when pulled back inside dash threshold**
- Given the touch was in the dash zone
- When the drag distance drops below 56px
- Then dashHeld becomes false and the thumb returns to blue

**Scenario: Dash clears on stick release**
- Given the player lifts their finger while in the dash zone
- Then dashHeld is immediately cleared

**Scenario: Jump button triggers jump**
- Given the player taps the green jump button on the right side
- Then the elephant jumps (jumpJustPressed is true for exactly 1 frame)

**Scenario: Dash button triggers dash**
- Given the player holds the orange dash button on the right side
- Then the elephant dashes for as long as the button is held

**Scenario: Buttons reposition on window resize**
- Given the window is resized
- Then touch buttons reposition to maintain their margins from screen edges

**Scenario: Multiple simultaneous touches supported**
- Given up to 4 pointers are active
- Then each pointer is independently routed to stick or button

---

## Feature: Audio

**Scenario: Bounce sound on platform or wall hit**
- Given the fruit contacts a platform or wall
- Then a spring twang sound plays, with volume scaled to impact velocity

**Scenario: Landing thud**
- Given the elephant lands hard (previous fall velocity > 7 px/frame)
- Then a sub-bass thud sound plays

**Scenario: Crate break sound**
- Given the elephant dashes into a crate
- Then a layered 4-component crate-break sound plays (sub-bass thud, low rumble, mid crack, high snap)
