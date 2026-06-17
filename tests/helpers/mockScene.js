import { vi } from 'vitest';

export function createMockSprite() {
  const sprite = {
    x: 0, y: 0, rotation: 0, displayHeight: 90,
    body: { id: 1, label: 'elephant', velocity: { x: 0, y: 0 }, angle: 0 },
    setVelocityX: vi.fn(function(x) { sprite.body.velocity.x = x; }),
    setVelocityY: vi.fn(function(y) { sprite.body.velocity.y = y; }),
    setVelocity: vi.fn(),
    setPosition: vi.fn(function(x, y) { sprite.x = x; sprite.y = y; }),
    setScale: vi.fn().mockReturnThis(),
    setFixedRotation: vi.fn().mockReturnThis(),
    setFriction: vi.fn().mockReturnThis(),
    setFrictionAir: vi.fn().mockReturnThis(),
    setBounce: vi.fn().mockReturnThis(),
    setMass: vi.fn().mockReturnThis(),
    setDepth: vi.fn().mockReturnThis(),
    setFlipX: vi.fn(),
    play: vi.fn(),
    anims: { timeScale: 1 },
  };
  return sprite;
}

export function createMockScene() {
  const sprite = createMockSprite();
  const scene = {
    matter: {
      add: {
        sprite: vi.fn(() => sprite),
        rectangle: vi.fn(() => ({ id: Math.floor(Math.random() * 10000), label: '' })),
        image: vi.fn(() => ({
          body: { label: '', velocity: { x: 0, y: 0 }, angularVelocity: 0, position: { x: 0, y: 0 } },
          x: 0, y: 0, fruitType: 'orange', active: true,
          setDepth: vi.fn().mockReturnThis(), destroy: vi.fn(),
        })),
      },
      world: {
        on: vi.fn(),
        walls: { left: { id: -1 }, right: { id: -2 } },
        remove: vi.fn(),
        setBounds: vi.fn(),
      },
      body: { setAngle: vi.fn(), setVelocity: vi.fn(), setAngularVelocity: vi.fn() },
    },
    anims: { exists: vi.fn(() => false), create: vi.fn() },
    add: {
      graphics: vi.fn(() => ({
        clear: vi.fn().mockReturnThis(), fillStyle: vi.fn().mockReturnThis(),
        fillRect: vi.fn().mockReturnThis(), lineStyle: vi.fn().mockReturnThis(),
        strokeCircle: vi.fn().mockReturnThis(), fillCircle: vi.fn().mockReturnThis(),
        beginPath: vi.fn().mockReturnThis(), strokePath: vi.fn().mockReturnThis(),
        moveTo: vi.fn().mockReturnThis(), lineTo: vi.fn().mockReturnThis(),
        setDepth: vi.fn().mockReturnThis(), setPosition: vi.fn().mockReturnThis(),
        setScrollFactor: vi.fn().mockReturnThis(), setVisible: vi.fn().mockReturnThis(),
        destroy: vi.fn(),
      })),
      image: vi.fn(() => ({
        setDepth: vi.fn().mockReturnThis(), setScale: vi.fn().mockReturnThis(),
        setScrollFactor: vi.fn().mockReturnThis(), setAlpha: vi.fn().mockReturnThis(),
        setTint: vi.fn().mockReturnThis(), setVisible: vi.fn().mockReturnThis(),
        setFlipX: vi.fn().mockReturnThis(), setOrigin: vi.fn().mockReturnThis(),
        x: 0, y: 0, visible: false,
        body: { velocity: { x: 0, y: 0 } }
      })),
      text: vi.fn(() => ({
        setDepth: vi.fn().mockReturnThis(), setScrollFactor: vi.fn().mockReturnThis(),
        setOrigin: vi.fn().mockReturnThis(), setX: vi.fn().mockReturnThis(),
        setVisible: vi.fn().mockReturnThis(), setText: vi.fn().mockReturnThis(),
        setAlpha: vi.fn().mockReturnThis(),
        visible: false,
        destroy: vi.fn(),
      })),
      container: vi.fn(() => ({
        setDepth: vi.fn().mockReturnThis(), setScrollFactor: vi.fn().mockReturnThis(),
        setVisible: vi.fn().mockReturnThis(), add: vi.fn(),
      })),
      rectangle: vi.fn(() => ({ setDepth: vi.fn().mockReturnThis(), destroy: vi.fn() })),
      circle: vi.fn(() => ({ setDepth: vi.fn().mockReturnThis(), destroy: vi.fn() })),
    },
    input: {
      keyboard: {
        createCursorKeys: vi.fn(() => ({
          left: { isDown: false }, right: { isDown: false },
          up: {}, space: {}, shift: { isDown: false },
        })),
        addKeys: vi.fn(() => ({ W: {}, A: { isDown: false }, S: {}, D: { isDown: false } })),
        on: vi.fn(),
      },
      gamepad: { gamepads: [] },
      on: vi.fn(),
    },
    cameras: {
      main: {
        shake: vi.fn(), width: 800, height: 600,
        scrollX: 0, scrollY: 0,
        setSize: vi.fn(), setBounds: vi.fn(), startFollow: vi.fn(),
        setBackgroundColor: vi.fn(),
      },
    },
    tweens: { add: vi.fn() },
    time: { addEvent: vi.fn(() => ({ remove: vi.fn() })), delayedCall: vi.fn(), now: 0 },
    scale: { width: 800, height: 600, on: vi.fn() },
    events: { once: vi.fn() },
    sounds: { playLand: vi.fn(), playBounce: vi.fn(), playCrateBreak: vi.fn() },
    touchControls: null,
    selectedPadIndex: -1,
    explodeCrate: vi.fn(),
    _sprite: sprite,
  };
  return { scene, sprite };
}
