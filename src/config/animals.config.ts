/**
 * Animal Entity Configurations
 *
 * Defines animation mappings and behavior settings for each animal type.
 * This is the single source of truth for how animations are matched
 * and how entities behave.
 */

import type {
  EntityAnimationConfig,
  AnimationActionName,
} from '../types/animation.types';
import type { AnimalConfig, BehaviorConfig } from '../types/entity.types';

// ============================================================================
// RABBIT CONFIGURATION
// ============================================================================

/**
 * Rabbit animation configuration.
 * Handles both "die" and "death" naming conventions.
 */
export const RABBIT_ANIMATION_CONFIG: EntityAnimationConfig<'rabbit'> = {
  entityType: 'rabbit',
  source: 'gltf-embedded',
  clipMatcher: (clipName: string): AnimationActionName | null => {
    const name = clipName.toLowerCase();

    // Idle animation
    if (name.includes('idle')) {
      return 'idle';
    }

    // Run/Walk - rabbit uses "run" or "walk"
    if (name.includes('run') || name.includes('walk')) {
      return 'run';
    }

    // Death animation - handles both "die" and "death" naming
    if (name.includes('die') || name.includes('death')) {
      return 'die';
    }

    return null;
  },
  fallbacks: {},
};

/**
 * Rabbit entity configuration.
 */
export const RABBIT_ENTITY_CONFIG: AnimalConfig = {
  name: 'RabbitController',
  animalType: 'rabbit',
  health: 10,
  maxHealth: 10,
  speed: 8.0,
  baseScale: 0.5,
  colliderRadius: 1.5,
  colliderYOffset: 1.5, // Matches radius to place mesh at feet level
};

/**
 * Rabbit behavior configuration.
 */
export const RABBIT_BEHAVIOR_CONFIG: BehaviorConfig = {
  type: 'prey',
  fleeDistance: 15.0,
};

// ============================================================================
// FOX CONFIGURATION
// ============================================================================

/**
 * Fox animation configuration.
 * Uses "gallop" for run, "death" for die, with exclusion patterns.
 */
export const FOX_ANIMATION_CONFIG: EntityAnimationConfig<'fox'> = {
  entityType: 'fox',
  source: 'gltf-embedded',
  clipMatcher: (clipName: string): AnimationActionName | null => {
    const name = clipName.toLowerCase();

    // Idle - but not "idle_react" variants
    if (name.includes('idle') && !name.includes('react')) {
      return 'idle';
    }

    // Gallop is the run animation - but not gallop_jump
    if (name.includes('gallop') && !name.includes('jump')) {
      return 'run';
    }

    // Walk animation (fallback for run)
    if (name.includes('walk')) {
      return 'walk';
    }

    // Attack animation
    if (name.includes('attack')) {
      return 'attack';
    }

    // Death animation
    if (name.includes('death')) {
      return 'die';
    }

    return null;
  },
  // Fall back to walk if no run animation
  fallbacks: { run: 'walk' },
};

/**
 * Fox entity configuration.
 */
export const FOX_ENTITY_CONFIG: AnimalConfig = {
  name: 'FoxController',
  animalType: 'fox',
  health: 30,
  maxHealth: 30,
  speed: 6.0,
  baseScale: 0.35,
  colliderRadius: 0.8,
  colliderYOffset: 0.2,
};

/**
 * Fox behavior configuration.
 */
export const FOX_BEHAVIOR_CONFIG: BehaviorConfig = {
  type: 'predator',
  viewDistance: 25.0,
  attackDistance: 2.0,
  attackDamage: 15,
  chaseSpeed: 10.0,
};

// ============================================================================
// MUTANT CONFIGURATION
// ============================================================================

/**
 * Mutant animation configuration.
 * Uses FBX separate files with explicit key mapping.
 */
export const MUTANT_ANIMATION_CONFIG: EntityAnimationConfig<'mutant'> = {
  entityType: 'mutant',
  source: 'fbx-separate',
  clipMatcher: (key: string): AnimationActionName | null => {
    // FBX files are mapped by explicit keys from entry.ts
    // These match the keys used in SetAnim calls
    const mapping: Record<string, AnimationActionName> = {
      idle: 'idle',
      walk: 'walk',
      run: 'run',
      attack: 'attack',
      die: 'die',
    };
    return mapping[key] ?? null;
  },
  fallbacks: {},
};

/**
 * Mutant entity configuration.
 */
export const MUTANT_ENTITY_CONFIG: AnimalConfig = {
  name: 'CharacterController',
  animalType: 'mutant',
  health: 100,
  maxHealth: 100,
  speed: 0.01, // Uses root motion
  baseScale: 0.01,
  colliderRadius: 0.5,
  colliderYOffset: 1.0,
};

/**
 * Mutant behavior configuration.
 */
export const MUTANT_BEHAVIOR_CONFIG: BehaviorConfig = {
  type: 'predator',
  viewDistance: 20.0,
  attackDistance: 2.2,
  attackDamage: 25,
  chaseSpeed: 0.015,
};

// ============================================================================
// T-REX CONFIGURATION
// ============================================================================

/**
 * T-Rex animation configuration.
 * FBX with embedded animations.
 */
export const TREX_ANIMATION_CONFIG: EntityAnimationConfig<'trex'> = {
  entityType: 'trex',
  source: 'fbx-embedded',
  clipMatcher: (clipName: string): AnimationActionName | null => {
    const name = clipName.toLowerCase();

    if (name.includes('idle') || name.includes('stand')) {
      return 'idle';
    }

    if (name.includes('walk')) {
      return 'walk';
    }

    if (name.includes('run')) {
      return 'run';
    }

    if (name.includes('attack') || name.includes('bite')) {
      return 'attack';
    }

    if (name.includes('die') || name.includes('death')) {
      return 'die';
    }

    return null;
  },
  fallbacks: { run: 'walk' },
};

/**
 * T-Rex entity configuration.
 * Slow but deadly predator.
 */
export const TREX_ENTITY_CONFIG: AnimalConfig = {
  name: 'TRexController',
  animalType: 'trex',
  health: 150,
  maxHealth: 150,
  speed: 3.0,
  baseScale: 0.025,
  colliderRadius: 6.0,
  colliderYOffset: 0.8,
  healthBarYOffset: 4.0,
  healthBarScale: 3.0,
};

/**
 * T-Rex behavior configuration.
 * Slow but massive damage.
 */
export const TREX_BEHAVIOR_CONFIG: BehaviorConfig = {
  type: 'predator',
  viewDistance: 30.0,
  attackDistance: 4.0,
  attackDamage: 50, // Massive damage
  chaseSpeed: 4.0,
};

// ============================================================================
// APATOSAURUS CONFIGURATION
// ============================================================================

/**
 * Apatosaurus animation configuration.
 * FBX with embedded animations.
 */
export const APATOSAURUS_ANIMATION_CONFIG: EntityAnimationConfig<'apatosaurus'> = {
  entityType: 'apatosaurus',
  source: 'fbx-embedded',
  clipMatcher: (clipName: string): AnimationActionName | null => {
    const name = clipName.toLowerCase();

    if (name.includes('idle') || name.includes('stand')) {
      return 'idle';
    }

    if (name.includes('walk')) {
      return 'walk';
    }

    if (name.includes('run')) {
      return 'run';
    }

    if (name.includes('die') || name.includes('death')) {
      return 'die';
    }

    return null;
  },
  fallbacks: { run: 'walk' },
};

/**
 * Apatosaurus entity configuration.
 * Peaceful herbivore with lots of health.
 */
export const APATOSAURUS_ENTITY_CONFIG: AnimalConfig = {
  name: 'ApatosaurusController',
  animalType: 'apatosaurus',
  health: 150,
  maxHealth: 150,
  speed: 4.0,
  baseScale: 0.02,
  colliderRadius: 8.0,
  colliderYOffset: 1.0,
  healthBarYOffset: 6.0,
  healthBarScale: 4.0,
};

/**
 * Apatosaurus behavior configuration.
 * Peaceful, flees from player.
 */
export const APATOSAURUS_BEHAVIOR_CONFIG: BehaviorConfig = {
  type: 'prey',
  fleeDistance: 20.0,
};

// ============================================================================
// REGISTRY
// ============================================================================

/**
 * Animation config registry by animal type.
 */
export const ANIMATION_CONFIGS = {
  rabbit: RABBIT_ANIMATION_CONFIG,
  fox: FOX_ANIMATION_CONFIG,
  mutant: MUTANT_ANIMATION_CONFIG,
  trex: TREX_ANIMATION_CONFIG,
  apatosaurus: APATOSAURUS_ANIMATION_CONFIG,
} as const;

/**
 * Entity config registry by animal type.
 */
export const ENTITY_CONFIGS = {
  rabbit: RABBIT_ENTITY_CONFIG,
  fox: FOX_ENTITY_CONFIG,
  mutant: MUTANT_ENTITY_CONFIG,
  trex: TREX_ENTITY_CONFIG,
  apatosaurus: APATOSAURUS_ENTITY_CONFIG,
} as const;

/**
 * Behavior config registry by animal type.
 */
export const BEHAVIOR_CONFIGS = {
  rabbit: RABBIT_BEHAVIOR_CONFIG,
  fox: FOX_BEHAVIOR_CONFIG,
  mutant: MUTANT_BEHAVIOR_CONFIG,
  trex: TREX_BEHAVIOR_CONFIG,
  apatosaurus: APATOSAURUS_BEHAVIOR_CONFIG,
} as const;

// ============================================================================
// TYPE EXPORTS
// ============================================================================

/**
 * Valid animal type keys.
 */
export type ConfiguredAnimalType = keyof typeof ANIMATION_CONFIGS;

/**
 * Get animation config for an animal type.
 */
export function getAnimationConfig(
  type: ConfiguredAnimalType
): EntityAnimationConfig {
  return ANIMATION_CONFIGS[type];
}

/**
 * Get entity config for an animal type.
 */
export function getEntityConfig(type: ConfiguredAnimalType): AnimalConfig {
  return ENTITY_CONFIGS[type];
}

/**
 * Get behavior config for an animal type.
 */
export function getBehaviorConfig(type: ConfiguredAnimalType): BehaviorConfig {
  return BEHAVIOR_CONFIGS[type];
}
