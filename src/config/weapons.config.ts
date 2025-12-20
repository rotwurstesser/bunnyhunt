/**
 * Weapon Configuration
 *
 * Defines all weapon types, their stats, and visual settings.
 * Uses ClipMatcher pattern for animation name resolution (same as animals).
 */

import type { ClipMatcher } from '../types/animation.types';

// ============================================================================
// WEAPON TYPES
// ============================================================================

/** Weapon fire type */
export type WeaponFireType = 'hitscan' | 'projectile';

/** Weapon tier keys */
export type WeaponKey = 'rifle' | 'ak47' | 'shotgun' | 'gatling' | 'grenadeLauncher' | 'nuke';

/** Weapon animation action names */
export type WeaponAnimationName = 'idle' | 'shoot' | 'reload';

// ============================================================================
// WEAPON CONFIG INTERFACE
// ============================================================================

/** Vector3-like for offsets */
export interface Vector3Like {
  readonly x: number;
  readonly y: number;
  readonly z: number;
}

/** Full weapon configuration */
export interface WeaponConfig {
  /** Display name */
  readonly name: string;

  /** Fire rate in seconds between shots */
  readonly fireRate: number;

  /** Damage per shot */
  readonly damage: number;

  /** Magazine size */
  readonly magAmmo: number;

  /** Ammo per magazine (usually same as magAmmo) */
  readonly ammoPerMag: number;

  /** Maximum total ammo capacity */
  readonly maxAmmo: number;

  /** Fire type - hitscan or projectile */
  readonly type: WeaponFireType;

  /** Asset key for 3D model */
  readonly modelKey: string;

  /** Scale for FPS view */
  readonly modelScale: number;

  /** Scale for pickup display */
  readonly pickupScale: number;

  /** Position offset for FPS view (no arms) */
  readonly positionOffset: Vector3Like;

  /** Rotation offset in radians */
  readonly rotationOffset: Vector3Like;

  /** Muzzle flash scale multiplier */
  readonly muzzleFlashScale: number;

  /** Visual recoil amount */
  readonly recoil: number;

  /** Glow color for UI/effects */
  readonly glowColor: number;

  /** Shot spread (0 for perfect accuracy) */
  readonly spread: number;

  /** Number of pellets per shot (1 for normal guns) */
  readonly pellets: number;

  /** Explosion radius (0 for no explosion) */
  readonly explosionRadius: number;

  /** Explosion damage (0 for no explosion) */
  readonly explosionDamage: number;
}

// ============================================================================
// WEAPON ANIMATION CONFIG
// ============================================================================

/** Weapon animation configuration */
export interface WeaponAnimationConfig {
  /** Source type - weapons use index-based from GLTF */
  readonly source: 'index-based';

  /** Maps animation index to action name */
  readonly indexMapping: Record<number, WeaponAnimationName>;

  /** Clip matcher for name-based resolution */
  readonly clipMatcher: ClipMatcher;

  /** Fallback animations */
  readonly fallbacks: Partial<Record<WeaponAnimationName, WeaponAnimationName>>;

  /** Animation speed multipliers */
  readonly speeds: Partial<Record<WeaponAnimationName, number>>;
}

// ============================================================================
// WEAPON DEFINITIONS
// ============================================================================

export const WEAPONS: Record<WeaponKey, WeaponConfig> = {
  rifle: {
    name: 'Pistol',
    fireRate: 0.5,
    damage: 6,
    magAmmo: 12,
    ammoPerMag: 12,
    maxAmmo: 60,
    type: 'hitscan',
    modelKey: 'pistol',
    modelScale: 0.15,
    pickupScale: 0.08,
    positionOffset: { x: 0.15, y: -0.12, z: -0.25 },
    rotationOffset: { x: 0, y: Math.PI / 2, z: 0 },
    muzzleFlashScale: 0.8,
    recoil: 0.015,
    glowColor: 0x88ff88,
    spread: 0.02,
    pellets: 1,
    explosionRadius: 0,
    explosionDamage: 0,
  },

  ak47: {
    name: 'SMG',
    fireRate: 0.1,
    damage: 2,
    magAmmo: 35,
    ammoPerMag: 35,
    maxAmmo: 175,
    type: 'hitscan',
    modelKey: 'smg',
    modelScale: 0.12,
    pickupScale: 0.06,
    positionOffset: { x: 0.12, y: -0.1, z: -0.3 },
    rotationOffset: { x: 0, y: Math.PI / 2, z: 0 },
    muzzleFlashScale: 1.0,
    recoil: 0.006,
    glowColor: 0x44ff44,
    spread: 0.05,
    pellets: 1,
    explosionRadius: 0,
    explosionDamage: 0,
  },

  gatling: {
    name: 'Minigun',
    fireRate: 0.03,
    damage: 1.2,
    magAmmo: 100,
    ammoPerMag: 100,
    maxAmmo: 500,
    type: 'hitscan',
    modelKey: 'minigun',
    modelScale: 0.02,
    pickupScale: 0.01,
    positionOffset: { x: 0.2, y: -0.25, z: -0.6 },
    rotationOffset: { x: 0, y: Math.PI, z: 0 },
    muzzleFlashScale: 1.5,
    recoil: 0.005,
    glowColor: 0x4488ff,
    spread: 0.08,
    pellets: 1,
    explosionRadius: 0,
    explosionDamage: 0,
  },

  shotgun: {
    name: 'Shotgun',
    fireRate: 0.8,
    damage: 2.5, // x 8 pellets = 20 dmg
    magAmmo: 8,
    ammoPerMag: 8,
    maxAmmo: 40,
    type: 'hitscan',
    modelKey: 'shotgun',
    modelScale: 0.4,
    pickupScale: 0.15,
    positionOffset: { x: 0.2, y: -0.15, z: -0.4 },
    rotationOffset: { x: 0, y: Math.PI, z: 0 },
    muzzleFlashScale: 2.0,
    recoil: 0.1,
    glowColor: 0xffaa00,
    spread: 0.15,
    pellets: 8,
    explosionRadius: 0,
    explosionDamage: 0,
  },

  grenadeLauncher: {
    name: 'Grenade Launcher',
    fireRate: 1.2,
    damage: 10, // Direct hit
    magAmmo: 6,
    ammoPerMag: 6,
    maxAmmo: 30,
    type: 'projectile',
    modelKey: 'grenadeLauncher',
    modelScale: 0.3,
    pickupScale: 0.12,
    positionOffset: { x: 0.15, y: -0.12, z: -0.35 },
    rotationOffset: { x: 0, y: Math.PI, z: 0 },
    muzzleFlashScale: 1.5,
    recoil: 0.08,
    glowColor: 0xff8800,
    spread: 0,
    pellets: 1,
    explosionRadius: 8, // 8 unit explosion radius
    explosionDamage: 40, // 40 damage in explosion
  },

  nuke: {
    name: 'Nuke Launcher',
    fireRate: 1.0,
    damage: 100,
    magAmmo: 1,
    ammoPerMag: 1,
    maxAmmo: 10,
    type: 'projectile',
    modelKey: 'smg2',
    modelScale: 0.12,
    pickupScale: 0.06,
    positionOffset: { x: 0.12, y: -0.1, z: -0.3 },
    rotationOffset: { x: 0, y: 0, z: 0 },
    muzzleFlashScale: 0.6,
    recoil: 0.05,
    glowColor: 0xff4444,
    spread: 0,
    pellets: 1,
    explosionRadius: 50, // Nuke has massive radius
    explosionDamage: 9999, // Instant kill
  },
} as const;

// ============================================================================
// WEAPON TIERS AND UNLOCKS
// ============================================================================

/** Order of weapon unlocks */
export const WEAPON_TIERS: readonly WeaponKey[] = ['rifle', 'ak47', 'shotgun', 'gatling', 'grenadeLauncher', 'nuke'];

/** Kill thresholds for each weapon tier */
export const WEAPON_THRESHOLDS: readonly number[] = [0, 5, 15, 30, 50, 75];

// ============================================================================
// ANIMATION CONFIG
// ============================================================================

/**
 * Standard weapon animation config.
 * Weapons use index-based animation loading from GLTF models.
 * Index order: [shoot, idle, reload]
 */
export const WEAPON_ANIMATION_CONFIG: WeaponAnimationConfig = {
  source: 'index-based',

  // Standard index mapping for weapon models
  indexMapping: {
    0: 'shoot',
    1: 'idle',
    2: 'reload',
  },

  // Fallback clip matcher for name-based resolution
  clipMatcher: (clipName: string): WeaponAnimationName | null => {
    const name = clipName.toLowerCase();
    if (name.includes('idle') || name.includes('rest')) return 'idle';
    if (name.includes('shoot') || name.includes('fire')) return 'shoot';
    if (name.includes('reload') || name.includes('load')) return 'reload';
    return null;
  },

  fallbacks: {
    reload: 'idle', // If no reload animation, stay idle
  },

  speeds: {
    shoot: 3.0, // Shoot animation plays at 3x speed
    idle: 1.0,
    reload: 1.0,
  },
};

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Get weapon configuration by key.
 * Defaults to rifle if key not found.
 */
export function getWeaponConfig(weaponKey: string): WeaponConfig {
  return WEAPONS[weaponKey as WeaponKey] ?? WEAPONS.rifle;
}

/**
 * Get the appropriate weapon key for a given kill count.
 */
export function getWeaponForKills(kills: number): WeaponKey {
  let tierIndex = 0;
  for (let i = WEAPON_THRESHOLDS.length - 1; i >= 0; i--) {
    if (kills >= WEAPON_THRESHOLDS[i]) {
      tierIndex = i;
      break;
    }
  }
  return WEAPON_TIERS[tierIndex];
}

/**
 * Get all weapon keys.
 */
export function getAllWeaponKeys(): readonly WeaponKey[] {
  return WEAPON_TIERS;
}

/**
 * Check if a weapon key is valid.
 */
export function isValidWeaponKey(key: string): key is WeaponKey {
  return key in WEAPONS;
}
