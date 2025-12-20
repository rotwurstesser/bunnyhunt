/**
 * Animation System Type Definitions
 *
 * Provides type-safe animation handling across all entity types,
 * with support for different animation sources (GLTF, FBX, index-based).
 */

import type * as THREE from 'three';

/**
 * Standard animation action names used across all entities.
 * Each entity type maps its specific clip names to these standard actions.
 */
export type AnimationActionName =
  | 'idle'
  | 'walk'
  | 'run'
  | 'attack'
  | 'die'
  | 'reload'
  | 'shoot'
  | 'flee';

/**
 * Animal types for type-safe entity identification.
 */
export type AnimalType = 'rabbit' | 'fox' | 'mutant';

/**
 * Weapon keys for type-safe weapon identification.
 */
export type WeaponKey = 'rifle' | 'ak47' | 'gatling' | 'nuke';

/**
 * Animation source types - determines how animations are loaded.
 *
 * - 'gltf-embedded': Animations embedded in GLTF/GLB model (Rabbit, Fox)
 * - 'fbx-separate': Animations in separate FBX files (Mutant)
 * - 'index-based': Animations referenced by array index (Weapons - legacy)
 */
export type AnimationSource = 'gltf-embedded' | 'fbx-separate' | 'index-based';

/**
 * Clip matcher function type.
 * Takes a clip name and returns the standardized action name, or null if no match.
 *
 * Example: "Gallop_Jump" -> null (excluded), "Gallop" -> 'run'
 */
export type ClipMatcher = (clipName: string) => AnimationActionName | null;

/**
 * Configuration for entity animations.
 * Each entity type has its own config that defines how to map
 * model animation clips to standard action names.
 *
 * @template T - Entity type identifier (e.g., 'rabbit', 'fox')
 */
export interface EntityAnimationConfig<T extends string = string> {
  /** Entity type identifier */
  readonly entityType: T;

  /** How animations are sourced from the model */
  readonly source: AnimationSource;

  /**
   * Function to match clip names to standard action names.
   * Returns null if the clip should be ignored.
   */
  readonly clipMatcher: ClipMatcher;

  /**
   * Fallback mappings when a requested animation is missing.
   * E.g., { run: 'walk' } means use 'walk' if 'run' not found.
   */
  readonly fallbacks: Partial<Record<AnimationActionName, AnimationActionName>>;

  /**
   * For index-based sources only: maps array indices to action names.
   * E.g., { 0: 'shoot', 1: 'idle', 2: 'reload' }
   */
  readonly indexMappings?: Record<number, AnimationActionName>;
}

/**
 * Options for playing an animation.
 */
export interface AnimationPlayOptions {
  /** Whether the animation should loop. Default: true */
  loop?: boolean;

  /** Duration of crossfade transition in seconds. Default: 0.2 */
  crossFadeDuration?: number;

  /** Animation playback speed multiplier. Default: 1.0 */
  timeScale?: number;

  /** Whether to hold the last frame when animation ends. Default: false (or true if loop=false) */
  clampWhenFinished?: boolean;
}

/**
 * Animation action map for type-safe animation access.
 */
export type AnimationActionMap = Map<AnimationActionName, THREE.AnimationAction>;

/**
 * Animation clip dictionary for FBX-separate loading.
 */
export type AnimationClipDict = Record<string, THREE.AnimationClip>;
