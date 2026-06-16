import Phaser from 'phaser';

const MOVE_SPEED = 4.5;
const MOVE_SPEED_AIR = 3.2;
const JUMP_VELOCITY = -11;
const NORMAL_MAX_FALL = 11;
const STOMP_FALL_THRESHOLD = 7;

const BODY_SCALE = 0.4;

const KICK_MIN_SPEED = 0.5;
const KICK_POWER_SCALE = 1.6;

const DASH_SPEED = 9;

const WIND_STREAK_LIFE = 260;
const WIND_STREAK_SPEED = 280;
const WIND_STREAK_LEN_MIN = 35;
const WIND_STREAK_LEN_MAX = 100;

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

    this.windGraphics = scene.add.graphics().setDepth(9);
    this.windStreaks = [];
    this.isDashing = false;

    this._prevPadButtons = {};
    this.celebrateTimer = 0;

    this.facing = 1;
    this.groundContacts = 0;
    this.wasGrounded = true;
    this.surfaceAngle = 0;
    this.contactBodies = new Map();

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

    const STICK_DEAD = 0.2;
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
      const left = this.cursors.left.isDown || this.keys.A.isDown ||
        pads.some(p => padPressed(p, 14) || stickX(p) < -STICK_DEAD);
      const right = this.cursors.right.isDown || this.keys.D.isDown ||
        pads.some(p => padPressed(p, 15) || stickX(p) > STICK_DEAD);
      const jumpPressed =
        Phaser.Input.Keyboard.JustDown(this.cursors.up) ||
        Phaser.Input.Keyboard.JustDown(this.keys.W) ||
        pads.some(p => padJustDown(p, 0) || padJustDown(p, 12));
      const dashHeld =
        this.cursors.space?.isDown ||
        pads.some(p => padPressed(p, 2));

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
      if (jumpPressed && isGrounded) {
        this.sprite.setVelocityY(JUMP_VELOCITY);
      }

      // --- Fall cap ---
      if (!isGrounded && velocity.y > NORMAL_MAX_FALL) {
        this.sprite.setVelocityY(NORMAL_MAX_FALL);
      }

      // --- Landing stomp ---
      if (isGrounded && !this.wasGrounded && previousVelocityY > STOMP_FALL_THRESHOLD) {
        this.scene.cameras.main.shake(140, 0.006);
        this.scene.tweens.add({
          targets: this.sprite,
          scaleX: 1.18,
          scaleY: 0.8,
          duration: 70,
          yoyo: true,
          ease: 'Quad.easeOut',
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
    this.updateWindEffect(delta);

    // Record button states for next frame's justDown detection.
    for (const p of allPads) {
      for (let i = 0; i < (p.buttons?.length ?? 0); i++) {
        this._prevPadButtons[`${p.index}_${i}`] = p.buttons[i]?.pressed ?? false;
      }
    }
  }

  updateWindEffect(delta) {
    const ex = this.sprite.x;
    const ey = this.sprite.y;
    const isMoving = Math.abs(this.sprite.body.velocity.x) > 1;

    if (this.isDashing && isMoving) {
      for (let i = 0; i < 3; i++) {
        const len = WIND_STREAK_LEN_MIN + Math.random() * (WIND_STREAK_LEN_MAX - WIND_STREAK_LEN_MIN);
        const offsetX = this.facing * (Math.random() * 55 - 10);
        const offsetY = (Math.random() - 0.5) * 72;
        this.windStreaks.push({
          x: ex + offsetX,
          y: ey + offsetY,
          vx: -this.facing * WIND_STREAK_SPEED,
          len,
          life: WIND_STREAK_LIFE,
          maxLife: WIND_STREAK_LIFE,
        });
      }
    }

    this.windGraphics.clear();
    for (let i = this.windStreaks.length - 1; i >= 0; i--) {
      const s = this.windStreaks[i];
      s.x += s.vx * delta * 0.001;
      s.life -= delta;
      if (s.life <= 0) { this.windStreaks.splice(i, 1); continue; }
      const alpha = (s.life / s.maxLife) * 0.85;
      const color = Math.random() > 0.4 ? 0xddf4ff : 0xffffff;
      this.windGraphics.fillStyle(color, alpha);
      const drawX = s.vx < 0 ? s.x - s.len : s.x;
      this.windGraphics.fillRect(drawX, s.y - 2, s.len, 4);
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
    this.surfaceAngle += (targetAngle - this.surfaceAngle) * 0.18;
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
