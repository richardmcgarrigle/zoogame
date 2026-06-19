import Phaser from 'phaser';
import DashEffect from './DashEffect.js';

const MOVE_SPEED = 4.5;
const MOVE_SPEED_AIR = 3.2;
const JUMP_VELOCITY = -11;
const NORMAL_MAX_FALL = 11;
const STOMP_FALL_THRESHOLD = 7;

const BODY_SCALE = 0.4;

const KICK_MIN_SPEED = 0.5;
const KICK_POWER_SCALE = 1.6;

const DASH_SPEED = 9;


// Gamepad analogue stick dead zone — normalised (0–1). Below this displacement
// the stick is ignored to avoid drift from centring imprecision.
// Note: TouchControls uses a separate pixel-based dead zone (STICK_DEAD_ZONE)
// for its on-screen stick, which measures physical displacement in screen px.
const GAMEPAD_STICK_DEAD = 0.2;

// Lerp coefficient for smoothly matching sprite rotation to surface angle.
// Lower = smoother/slower tilt; higher = snappier response.
const SURFACE_ANGLE_LERP = 0.18;

// Standard Gamepad / DualSense button indices
const PAD_BTN_CROSS    = 0;
const PAD_BTN_CIRCLE   = 1;
const PAD_BTN_SQUARE   = 2;
const PAD_BTN_TRIANGLE = 3;
const PAD_BTN_L1       = 4;
const PAD_BTN_R1       = 5;
const PAD_BTN_L2       = 6;
const PAD_BTN_R2       = 7;
const PAD_BTN_D_UP     = 12;
const PAD_BTN_D_DOWN   = 13;
const PAD_BTN_D_LEFT   = 14;
const PAD_BTN_D_RIGHT  = 15;

export default class Elephant {
  constructor(scene, x, y) {
    this.scene = scene;

    this.sprite = scene.matter.add.sprite(x, y, 'elephant_idle');
    this.sprite.setScale(BODY_SCALE);
    this.sprite.setFixedRotation();
    this.sprite.setFriction(0.08, 0.01);
    this.sprite.setFrictionAir(0.01);
    this.sprite.setBounce(0);
    this.sprite.setMass(40);
    this.sprite.body.label = 'elephant';
    this.sprite.setDepth(10);

    if (!scene.anims.exists('elephant-idle')) {
      scene.anims.create({ key: 'elephant-idle',      frames: [{ key: 'elephant_idle' }],   frameRate: 4, repeat: -1 });
      scene.anims.create({ key: 'elephant-run',       frames: [{ key: 'elephant_run_1' }, { key: 'elephant_run_2' }], frameRate: 8, repeat: -1 });
      scene.anims.create({ key: 'elephant-jump-up',   frames: [{ key: 'elephant_jump_up' }], frameRate: 1, repeat: -1 });
      scene.anims.create({ key: 'elephant-jump-dn',   frames: [{ key: 'elephant_jump_dn' }], frameRate: 1, repeat: -1 });
      scene.anims.create({ key: 'elephant-celebrate', frames: [{ key: 'elephant_celebrate' }], frameRate: 1, repeat: -1 });
    }
    this.sprite.play('elephant-idle');

    this.dashEffect = new DashEffect(scene);
    this.isDashing = false;

    this._prevPadButtons = {};
    this.celebrateTimer = 0;

    this.facing = 1;
    this.groundContacts = 0;
    this.wasGrounded = true;
    this.surfaceAngle = 0;
    this.contactBodies = new Map();
    this.airJumpsUsed = 0;

    scene.matter.world.on('collisionstart', this.onCollisionStart, this);
    scene.matter.world.on('collisionend', this.onCollisionEnd, this);

    this.cursors = scene.input.keyboard.createCursorKeys();
    this.keys = scene.input.keyboard.addKeys('W,A,S,D');
  }

  isPlatformLabel(label) {
    return label === 'platform' || label === 'ground';
  }

  isKickableLabel(label) {
    return label === 'fruit' || label === 'crate';
  }

  onCollisionStart(event) {
    for (const pair of event.pairs) {
      const { bodyA, bodyB } = pair;
      const a = bodyA.label;
      const b = bodyB.label;
      if ((a === 'elephant' && this.isPlatformLabel(b)) || (b === 'elephant' && this.isPlatformLabel(a))) {
        this.groundContacts++;
        const surfaceBody = a === 'elephant' ? bodyB : bodyA;
        this.contactBodies.set(surfaceBody.id, surfaceBody);
      }
      if (a === 'elephant' && this.isKickableLabel(b)) {
        if (this.isDashing && b === 'crate') {
          this.scene.explodeCrate(bodyB.gameObject);
        } else {
          this.applyKickImpulse(bodyA, bodyB);
        }
      } else if (b === 'elephant' && this.isKickableLabel(a)) {
        if (this.isDashing && a === 'crate') {
          this.scene.explodeCrate(bodyA.gameObject);
        } else {
          this.applyKickImpulse(bodyB, bodyA);
        }
      }
    }
  }

  onCollisionEnd(event) {
    for (const pair of event.pairs) {
      const { bodyA, bodyB } = pair;
      const a = bodyA.label;
      const b = bodyB.label;
      if ((a === 'elephant' && this.isPlatformLabel(b)) || (b === 'elephant' && this.isPlatformLabel(a))) {
        this.groundContacts = Math.max(0, this.groundContacts - 1);
        const surfaceBody = a === 'elephant' ? bodyB : bodyA;
        this.contactBodies.delete(surfaceBody.id);
      }
    }
  }

  celebrate(duration) {
    this.celebrateTimer = duration;
    this.sprite.setVelocity(0, 0);
    this.sprite.play('elephant-idle', true);
  }

  update(time, delta, props) {
    const body = this.sprite.body;

    const allPads = (this.scene.input.gamepad?.gamepads ?? []).filter(Boolean);

    const isFrozen = this.celebrateTimer > 0;
    if (isFrozen) {
      this.celebrateTimer -= delta;
      this.sprite.setVelocity(0, 0);
    }

    const isGrounded = this.groundContacts > 0;
    const velocity = body.velocity;
    const previousVelocityY = velocity.y;

    // Gamepad input. Phaser's GamepadButton has no justDown — track it manually.
    // Button indices (Standard Gamepad / DualSense):
    //   0=Cross  1=Circle  2=Square  3=Triangle
    //   4=L1  5=R1  6=L2  7=R2
    //  12=D-up  13=D-down  14=D-left  15=D-right
    const selectedIdx = this.scene.selectedPadIndex ?? -1;
    const pads = selectedIdx >= 0
      ? allPads.filter(p => p.index === selectedIdx)
      : allPads;

    const padPressed = (p, i) => p.buttons?.[i]?.pressed ?? false;
    const padJustDown = (p, i) => padPressed(p, i) && !(this._prevPadButtons[`${p.index}_${i}`] ?? false);
    const stickX = (p) => p.leftStick?.x ?? p.axes?.[0] ?? 0;

    if (!isFrozen) {
      const touch = this.scene.touchControls;
      const left = this.cursors.left.isDown || this.keys.A.isDown ||
        pads.some(p => padPressed(p, PAD_BTN_D_LEFT) || stickX(p) < -GAMEPAD_STICK_DEAD) ||
        (touch?.left ?? false);
      const right = this.cursors.right.isDown || this.keys.D.isDown ||
        pads.some(p => padPressed(p, PAD_BTN_D_RIGHT) || stickX(p) > GAMEPAD_STICK_DEAD) ||
        (touch?.right ?? false);
      const jumpPressed =
        Phaser.Input.Keyboard.JustDown(this.cursors.up) ||
        Phaser.Input.Keyboard.JustDown(this.cursors.space) ||
        Phaser.Input.Keyboard.JustDown(this.keys.W) ||
        pads.some(p => padJustDown(p, PAD_BTN_CROSS) || padJustDown(p, PAD_BTN_D_UP)) ||
        (touch?.consumeJump() ?? false);
      const dashHeld =
        this.cursors.shift?.isDown ||
        pads.some(p => padPressed(p, PAD_BTN_SQUARE)) ||
        (touch?.dashHeld ?? false);

      // --- Dash (hold to sustain) ---
      this.isDashing = dashHeld;

      if (dashHeld) {
        if (left) this.facing = -1;
        else if (right) this.facing = 1;
        this.sprite.setVelocityX(this.facing * DASH_SPEED);
      } else {
        // --- Horizontal movement ---
        const speed = isGrounded ? MOVE_SPEED : MOVE_SPEED_AIR;
        if (left) {
          this.sprite.setVelocityX(-speed);
          this.facing = -1;
        } else if (right) {
          this.sprite.setVelocityX(speed);
          this.facing = 1;
        } else if (isGrounded) {
          this.sprite.setVelocityX(velocity.x * 0.8);
        }
      }

      // --- Jump ---
      if (isGrounded) {
        this.airJumpsUsed = 0;
      }
      if (jumpPressed) {
        if (isGrounded) {
          this.sprite.setVelocityY(JUMP_VELOCITY);
        } else if (this.airJumpsUsed < 1) {
          this.sprite.setVelocityY(JUMP_VELOCITY);
          this.airJumpsUsed++;
        }
      }

      // --- Fall cap ---
      if (!isGrounded && velocity.y > NORMAL_MAX_FALL) {
        this.sprite.setVelocityY(NORMAL_MAX_FALL);
      }

      // --- Landing stomp ---
      if (isGrounded && !this.wasGrounded && previousVelocityY > STOMP_FALL_THRESHOLD) {
        this.scene.sounds?.playLand();
        this.scene.cameras.main.shake(140, 0.006);
        if (this._stompTween) {
          this._stompTween.stop();
          this._stompTween = null;
          this.sprite.setScale(BODY_SCALE);
        }
        this._stompTween = this.scene.tweens.add({
          targets: this.sprite,
          scaleX: BODY_SCALE * 1.18,
          scaleY: BODY_SCALE * 0.8,
          duration: 70,
          yoyo: true,
          ease: 'Quad.easeOut',
          onComplete: () => {
            this.sprite.setScale(BODY_SCALE);
            this._stompTween = null;
          },
        });
      }

      // --- Animation ---
      if (!isGrounded && velocity.y < -1) {
        this.sprite.play('elephant-jump-up', true);
        this.sprite.anims.timeScale = 1;
      } else if (!isGrounded && velocity.y > 2) {
        this.sprite.play('elephant-jump-dn', true);
        this.sprite.anims.timeScale = 1;
      } else if (left || right || dashHeld) {
        this.sprite.play('elephant-run', true);
        this.sprite.anims.timeScale = dashHeld ? 2.5 : 1;
      } else {
        this.sprite.play('elephant-idle', true);
        this.sprite.anims.timeScale = 1;
      }
    } // end !isFrozen

    this.wasGrounded = isGrounded;
    this.updateVisuals(time);
    this.dashEffect.update(delta, this.sprite.x, this.sprite.y, this.isDashing, this.facing, this.sprite.body.velocity.x);

    // Record button states for next frame's justDown detection.
    for (const p of allPads) {
      for (let i = 0; i < (p.buttons?.length ?? 0); i++) {
        this._prevPadButtons[`${p.index}_${i}`] = p.buttons[i]?.pressed ?? false;
      }
    }
  }

  updateVisuals(time) {
    const facing = this.facing;
    this.sprite.setFlipX(facing < 0);

    // Tilt the sprite to match the slope of the surface being stood on.
    const isGrounded = this.groundContacts > 0;
    let targetAngle = 0;
    if (isGrounded && this.contactBodies.size > 0) {
      let sum = 0;
      for (const b of this.contactBodies.values()) sum += b.angle;
      targetAngle = sum / this.contactBodies.size;
      targetAngle = Phaser.Math.Clamp(targetAngle, -0.61, 0.61);
    }
    this.surfaceAngle += (targetAngle - this.surfaceAngle) * SURFACE_ANGLE_LERP;
    this.sprite.rotation = this.surfaceAngle;
  }

  applyKickImpulse(elephantBody, propBody) {
    const dx = propBody.position.x - elephantBody.position.x;
    const dirX = dx !== 0 ? Math.sign(dx) : this.facing;
    const vx = elephantBody.velocity.x;
    const vy = elephantBody.velocity.y;
    const speed = Math.max(Math.abs(vx), KICK_MIN_SPEED);

    this.scene.matter.body.setVelocity(propBody, {
      x: dirX * speed * KICK_POWER_SCALE,
      y: Math.min(vy, 0) - 2.5 - Math.random() * 1.5,
    });
    this.scene.matter.body.setAngularVelocity(propBody, dirX * 0.25);
  }
}
