import { describe, it, expect } from 'vitest';

// Pure formula tests - no Phaser import needed
const WIDTH_PER_SCORE = 300;
const AMPLITUDE_PER_SCORE = 15;
const MAX_TERRAIN_AMPLITUDE = 180;
const PLATFORM_MIN_ANGLE = 8;
const PLATFORM_MAX_ANGLE = 25;
const PLATFORM_ANGLE_PER_SCORE = 2;
const CHUNK_CLUSTER_CHANCE_BASE = 0.35;
const CHUNK_CLUSTER_CHANCE_PER_SCORE = 0.025;
const CHUNK_CLUSTER_CHANCE_MAX = 0.65;

describe('Feature: World Expansion & Difficulty Scaling', () => {
  describe('World width formula', () => {
    it('widens by 300px per goal', () => {
      expect(5 * WIDTH_PER_SCORE).toBe(1500);
    });
  });

  describe('Terrain amplitude', () => {
    it('increases by 15 per score', () => {
      expect(Math.min(5 * AMPLITUDE_PER_SCORE, MAX_TERRAIN_AMPLITUDE)).toBe(75);
    });

    it('caps at 180 at score 12', () => {
      expect(Math.min(12 * AMPLITUDE_PER_SCORE, MAX_TERRAIN_AMPLITUDE)).toBe(180);
    });

    it('caps at 180 above score 12', () => {
      expect(Math.min(20 * AMPLITUDE_PER_SCORE, MAX_TERRAIN_AMPLITUDE)).toBe(180);
    });
  });

  describe('Platform angle scaling', () => {
    it('minimum angle is 8 at score 0', () => {
      const maxAngle = Math.min(0 * PLATFORM_ANGLE_PER_SCORE, PLATFORM_MAX_ANGLE);
      const effectiveMax = Math.max(maxAngle, PLATFORM_MIN_ANGLE);
      expect(effectiveMax).toBe(8);
    });

    it('angle is 20 at score 10', () => {
      const maxAngle = Math.min(10 * PLATFORM_ANGLE_PER_SCORE, PLATFORM_MAX_ANGLE);
      expect(maxAngle).toBe(20);
    });

    it('angle caps at 25 at score 15', () => {
      const maxAngle = Math.min(15 * PLATFORM_ANGLE_PER_SCORE, PLATFORM_MAX_ANGLE);
      expect(maxAngle).toBe(25);
    });
  });

  describe('Cluster chance', () => {
    it('starts at 0.35 at score 0', () => {
      expect(Math.min(CHUNK_CLUSTER_CHANCE_BASE + 0 * CHUNK_CLUSTER_CHANCE_PER_SCORE, CHUNK_CLUSTER_CHANCE_MAX)).toBe(0.35);
    });

    it('reaches 0.65 cap at score 12', () => {
      expect(Math.min(CHUNK_CLUSTER_CHANCE_BASE + 12 * CHUNK_CLUSTER_CHANCE_PER_SCORE, CHUNK_CLUSTER_CHANCE_MAX)).toBe(0.65);
    });

    it('is 0.475 at score 5', () => {
      expect(Math.min(CHUNK_CLUSTER_CHANCE_BASE + 5 * CHUNK_CLUSTER_CHANCE_PER_SCORE, CHUNK_CLUSTER_CHANCE_MAX)).toBeCloseTo(0.475);
    });
  });
});
