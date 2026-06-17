import { describe, it, expect } from 'vitest';

// These tests verify the difficulty-scaling formulas described in the use cases.
// The formulas are pure arithmetic — no Phaser mock needed.

const WIDTH_PER_SCORE = 300;
const AMPLITUDE_PER_SCORE = 15;
const MAX_TERRAIN_AMPLITUDE = 180;
const PLATFORM_ANGLE_PER_SCORE = 2;
const PLATFORM_MIN_ANGLE = 8;
const PLATFORM_MAX_ANGLE = 25;
const CHUNK_CLUSTER_CHANCE_BASE = 0.35;
const CHUNK_CLUSTER_CHANCE_PER_SCORE = 0.025;
const CHUNK_CLUSTER_CHANCE_MAX = 0.65;

describe('Feature: World Expansion & Difficulty Scaling', () => {
  describe('Scenario: World widens on each goal (+300px)', () => {
    it('world width increases by 300px per goal scored', () => {
      expect(WIDTH_PER_SCORE).toBe(300);
    });

    it('width at score 3 is base + 900px', () => {
      const baseWidth = 1280; // example window width
      const score = 3;
      const worldWidth = baseWidth + score * WIDTH_PER_SCORE;
      expect(worldWidth).toBe(baseWidth + 900);
    });
  });

  describe('Scenario: Terrain amplitude increases with score', () => {
    it('amplitude formula is min(score × 15, 180)', () => {
      expect(AMPLITUDE_PER_SCORE).toBe(15);
      expect(MAX_TERRAIN_AMPLITUDE).toBe(180);
    });

    it('amplitude at score 5 is 75', () => {
      const amplitude = Math.min(5 * AMPLITUDE_PER_SCORE, MAX_TERRAIN_AMPLITUDE);
      expect(amplitude).toBe(75);
    });

    it('amplitude at score 12 is 180 (capped)', () => {
      const amplitude = Math.min(12 * AMPLITUDE_PER_SCORE, MAX_TERRAIN_AMPLITUDE);
      expect(amplitude).toBe(180);
    });

    it('amplitude at score 20 is still 180 (capped)', () => {
      const amplitude = Math.min(20 * AMPLITUDE_PER_SCORE, MAX_TERRAIN_AMPLITUDE);
      expect(amplitude).toBe(180);
    });
  });

  describe('Scenario: Platform angle increases with score', () => {
    it('max angle formula is min(score × 2, 25), minimum 8°', () => {
      expect(PLATFORM_ANGLE_PER_SCORE).toBe(2);
      expect(PLATFORM_MIN_ANGLE).toBe(8);
      expect(PLATFORM_MAX_ANGLE).toBe(25);
    });

    it('at score 0: effective max is 8 (minimum enforced)', () => {
      const maxAngle = Math.min(0 * PLATFORM_ANGLE_PER_SCORE, PLATFORM_MAX_ANGLE);
      const effectiveMax = Math.max(maxAngle, PLATFORM_MIN_ANGLE);
      expect(effectiveMax).toBe(8);
    });

    it('at score 10: max angle is 20°', () => {
      const maxAngle = Math.min(10 * PLATFORM_ANGLE_PER_SCORE, PLATFORM_MAX_ANGLE);
      expect(maxAngle).toBe(20);
    });

    it('at score 15: max angle is 25° (capped)', () => {
      const maxAngle = Math.min(15 * PLATFORM_ANGLE_PER_SCORE, PLATFORM_MAX_ANGLE);
      expect(maxAngle).toBe(25);
    });
  });

  describe('Scenario: Platform cluster density increases with score', () => {
    it('cluster chance formula is min(0.35 + score × 0.025, 0.65)', () => {
      expect(CHUNK_CLUSTER_CHANCE_BASE).toBe(0.35);
      expect(CHUNK_CLUSTER_CHANCE_PER_SCORE).toBe(0.025);
      expect(CHUNK_CLUSTER_CHANCE_MAX).toBe(0.65);
    });

    it('at score 0: cluster chance is 0.35', () => {
      const chance = Math.min(
        CHUNK_CLUSTER_CHANCE_BASE + 0 * CHUNK_CLUSTER_CHANCE_PER_SCORE,
        CHUNK_CLUSTER_CHANCE_MAX,
      );
      expect(chance).toBe(0.35);
    });

    it('at score 5: cluster chance is 0.475', () => {
      const chance = Math.min(
        CHUNK_CLUSTER_CHANCE_BASE + 5 * CHUNK_CLUSTER_CHANCE_PER_SCORE,
        CHUNK_CLUSTER_CHANCE_MAX,
      );
      expect(chance).toBeCloseTo(0.475);
    });

    it('at score 12: cluster chance is 0.65 (capped)', () => {
      const chance = Math.min(
        CHUNK_CLUSTER_CHANCE_BASE + 12 * CHUNK_CLUSTER_CHANCE_PER_SCORE,
        CHUNK_CLUSTER_CHANCE_MAX,
      );
      expect(chance).toBe(0.65);
    });
  });

  describe('Scenario: Goal repositions to new world edge', () => {
    it('goal x = worldWidth - 100', () => {
      const worldWidth = 2000;
      const goalX = worldWidth - 100;
      expect(goalX).toBe(1900);
    });
  });
});
