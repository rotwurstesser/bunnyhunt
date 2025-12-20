/**
 * Config module exports
 */

// Animal configs
export {
  // Rabbit
  RABBIT_ANIMATION_CONFIG,
  RABBIT_ENTITY_CONFIG,
  RABBIT_BEHAVIOR_CONFIG,
  // Fox
  FOX_ANIMATION_CONFIG,
  FOX_ENTITY_CONFIG,
  FOX_BEHAVIOR_CONFIG,
  // Mutant
  MUTANT_ANIMATION_CONFIG,
  MUTANT_ENTITY_CONFIG,
  MUTANT_BEHAVIOR_CONFIG,
  // Registry
  ANIMATION_CONFIGS,
  ENTITY_CONFIGS,
  BEHAVIOR_CONFIGS,
  // Helpers
  getAnimationConfig,
  getEntityConfig,
  getBehaviorConfig,
  // Types
  type ConfiguredAnimalType,
} from './animals.config';

// Weapon configs
export {
  WEAPONS,
  WEAPON_TIERS,
  WEAPON_THRESHOLDS,
  WEAPON_ANIMATION_CONFIG,
  getWeaponConfig,
  getWeaponForKills,
  getAllWeaponKeys,
  isValidWeaponKey,
  // Types
  type WeaponKey,
  type WeaponFireType,
  type WeaponConfig,
  type WeaponAnimationName,
  type WeaponAnimationConfig,
  type Vector3Like,
} from './weapons.config';
