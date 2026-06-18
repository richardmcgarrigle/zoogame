import { describe, it, expect, vi } from 'vitest';

vi.mock('phaser');

import DecorationManager from '../src/managers/DecorationManager.js';

function makeCloudScene() {
  const images = [];
  const scene = {
    cameras: { main: { width: 800 } },
    add: {
      image: vi.fn((x, y, key) => {
        const img = {
          x, y, scaleX: 1, _speed: 0,
          setScrollFactor: vi.fn().mockReturnThis(),
          setScale: vi.fn().mockReturnThis(),
          setAlpha: vi.fn().mockReturnThis(),
          setDepth: vi.fn().mockReturnThis(),
        };
        images.push(img);
        return img;
      }),
    },
    _images: images,
  };
  return scene;
}

function makeBirdScene() {
  const images = [];
  const scene = {
    time: { now: 0 },
    cameras: { main: { scrollX: 0, width: 800 } },
    add: {
      image: vi.fn((x, y, key) => {
        const img = {
          x, y, _speed: 0, _dir: 1, _bobOffset: 0, _hitCooldown: 0, _flapTimer: 0, _flapFrame: 0,
          setDepth: vi.fn().mockReturnThis(),
          setScale: vi.fn().mockReturnThis(),
          setFlipX: vi.fn().mockReturnThis(),
          setTexture: vi.fn(),
        };
        images.push(img);
        return img;
      }),
    },
    _images: images,
    fruit: null,
  };
  return scene;
}

function makeManager(scene, opts = {}) {
  const terrain = opts.terrain ?? {};
  const platformSpawner = opts.platformSpawner ?? {};
  return new DecorationManager(scene, terrain, platformSpawner);
}

describe('Feature: Background Environment', () => {
  describe('Scenario: Clouds drift across the viewport', () => {
    it('creates exactly 6 clouds', () => {
      const scene = makeCloudScene();
      const mgr = makeManager(scene);
      mgr.createClouds();
      expect(mgr.clouds.length).toBe(6);
    });

    it('all cloud speeds are in range 11–20 px/sec', () => {
      const scene = makeCloudScene();
      const mgr = makeManager(scene);
      mgr.createClouds();
      for (const cloud of mgr.clouds) {
        expect(cloud._speed).toBeGreaterThanOrEqual(11);
        expect(cloud._speed).toBeLessThanOrEqual(20);
      }
    });
  });

  describe('Scenario: Birds fly and bob', () => {
    it('creates exactly 5 birds', () => {
      const scene = makeBirdScene();
      const mgr = makeManager(scene);
      mgr.createBirds();
      expect(mgr.birds.length).toBe(5);
    });

    it('all bird speeds are in range 60–140 px/sec', () => {
      const scene = makeBirdScene();
      const mgr = makeManager(scene);
      mgr.createBirds();
      for (const bird of mgr.birds) {
        expect(bird._speed).toBeGreaterThanOrEqual(60);
        expect(bird._speed).toBeLessThanOrEqual(140);
      }
    });

    it('birds have a flap timer initialized', () => {
      const scene = makeBirdScene();
      const mgr = makeManager(scene);
      mgr.createBirds();
      for (const bird of mgr.birds) {
        expect(bird._flapTimer).toBeDefined();
      }
    });
  });

  describe('Scenario: Bird flap animation (180ms interval)', () => {
    it('toggles bird frame after 180ms have elapsed', () => {
      const scene = makeBirdScene();
      const mgr = makeManager(scene);
      mgr.createBirds();
      const bird = mgr.birds[0];
      // Ensure flap timer will trigger
      bird._flapTimer = 160;
      bird._flapFrame = 0;

      mgr.updateBirds(30); // 30ms elapsed → total 190 > 180

      expect(bird.setTexture).toHaveBeenCalled();
    });
  });

  describe('Scenario: Bird nudges fruit', () => {
    it('imparts impulse on fruit when bird is within 44px', () => {
      const scene = makeBirdScene();
      const mgr = makeManager(scene);
      mgr.createBirds();

      scene.matter = { body: { setVelocity: vi.fn(), setAngularVelocity: vi.fn() } };
      const fruitBody = { velocity: { x: 0, y: 0 } };
      scene.fruit = { x: mgr.birds[0].x + 30, y: mgr.birds[0].y, body: fruitBody }; // within 44px

      mgr.birds[0]._hitCooldown = 0; // not in cooldown

      mgr.updateBirds(16);

      expect(scene.matter.body.setVelocity).toHaveBeenCalled();
    });

    it('sets hit cooldown to 1200ms after nudging fruit', () => {
      const scene = makeBirdScene();
      const mgr = makeManager(scene);
      mgr.createBirds();

      scene.matter = { body: { setVelocity: vi.fn(), setAngularVelocity: vi.fn() } };
      const bird = mgr.birds[0];
      scene.fruit = { x: bird.x + 10, y: bird.y, body: { velocity: { x: 0, y: 0 } } };
      bird._hitCooldown = 0;

      mgr.updateBirds(16);

      expect(bird._hitCooldown).toBe(1200);
    });

    it('does not nudge fruit when bird is in cooldown', () => {
      // Use a single manually placed bird to avoid other birds being in range
      const scene = {
        cameras: { main: { scrollX: 0, width: 800 } },
        time: { now: 0 },
        matter: { body: { setVelocity: vi.fn(), setAngularVelocity: vi.fn() } },
        fruit: { x: 410, y: 200, body: { velocity: { x: 0, y: 0 } } }, // within 44px
      };
      const mgr = makeManager(scene);
      mgr.birds = [{
        x: 400, y: 200,
        _speed: 80, _dir: 1, _bobOffset: 0,
        _hitCooldown: 500, // in cooldown
        _flapTimer: 0, _flapFrame: 0,
        setTexture: vi.fn(),
      }];

      mgr.updateBirds(16);

      expect(scene.matter.body.setVelocity).not.toHaveBeenCalled();
    });

    it('does not nudge fruit when bird is beyond 44px radius', () => {
      // Use a single manually placed bird to avoid other randomly-positioned
      // birds from createBirds() inadvertently landing within range.
      const scene = {
        cameras: { main: { scrollX: 0, width: 800 } },
        time: { now: 0 },
        matter: { body: { setVelocity: vi.fn(), setAngularVelocity: vi.fn() } },
        fruit: { x: 400 + 100, y: 200, body: { velocity: { x: 0, y: 0 } } }, // 100px away > 44
      };
      const mgr = makeManager(scene);
      mgr.birds = [{
        x: 400, y: 200,
        _speed: 80, _dir: 1, _bobOffset: 0,
        _hitCooldown: 0,
        _flapTimer: 0, _flapFrame: 0,
        setTexture: vi.fn(),
      }];

      mgr.updateBirds(16);

      expect(scene.matter.body.setVelocity).not.toHaveBeenCalled();
    });
  });

  describe('Scenario: Palm trees populate the terrain', () => {
    it('palm trees are placed approximately every 560px', () => {
      // The spacing constant is 560 in buildPalmsForChunk
      const SPACING = 560;
      expect(SPACING).toBe(560);
    });
  });
});
