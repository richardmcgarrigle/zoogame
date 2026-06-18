/**
 * Shared constants used by PlaygroundScene and its manager classes.
 *
 * Constants that are specific to a single manager or subsystem may live in
 * that module instead. Everything here is referenced by at least two modules.
 */

export const WORLD_HEIGHT = 1000;
export const GROUND_HEIGHT = 90;
export const GROUND_SURFACE_Y = WORLD_HEIGHT - GROUND_HEIGHT;
export const GROUND_DEPTH = GROUND_HEIGHT + 60;
export const TERRAIN_SEGMENT_WIDTH = 60;

export const AMPLITUDE_PER_SCORE = 15;
export const MAX_TERRAIN_AMPLITUDE = 180;

/** Duration (ms) for the new terrain chunk slide-up animation. */
export const TERRAIN_SLIDE_DURATION = 700;

export const OUTLINE = 0x1a1a1a;
export const OUTLINE_WIDTH = 6;
