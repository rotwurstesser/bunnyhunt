// Weapon configuration for all weapon types
// Each weapon maps to a specific 3D model loaded from poly.pizza

export const WEAPONS = {
  rifle: {
    name: 'Pistol',
    fireRate: 0.5,        // Medium speed
    damage: 15,
    magAmmo: 12,
    ammoPerMag: 12,
    maxAmmo: 60,
    type: 'hitscan',
    modelKey: 'pistol',   // Maps to assets['pistol']
    modelScale: 0.15,
    pickupScale: 0.08,    // Scale for pickup display
    // Position offsets for FPS view (no arms) - weapon points forward
    positionOffset: { x: 0.15, y: -0.12, z: -0.25 },
    rotationOffset: { x: 0, y: Math.PI, z: 0 },  // 180 deg to point forward
    muzzleFlashScale: 0.8,
    recoil: 0.015,
    glowColor: 0x88ff88   // Light green
  },
  ak47: {
    name: 'SMG',
    fireRate: 0.08,       // Fast automatic
    damage: 6,
    magAmmo: 35,
    ammoPerMag: 35,
    maxAmmo: 175,
    type: 'hitscan',
    modelKey: 'smg',      // Maps to assets['smg']
    modelScale: 0.12,
    pickupScale: 0.06,
    positionOffset: { x: 0.12, y: -0.1, z: -0.3 },
    rotationOffset: { x: 0, y: Math.PI / 2, z: 0 },  // +90 deg to point forward
    muzzleFlashScale: 1.0,
    recoil: 0.006,
    glowColor: 0x44ff44   // Green
  },
  gatling: {
    name: 'Assault Rifle',
    fireRate: 0.06,       // Very fast
    damage: 5,
    magAmmo: 45,
    ammoPerMag: 45,
    maxAmmo: 225,
    type: 'hitscan',
    modelKey: 'assaultRifle', // Maps to assets['assaultRifle']
    modelScale: 0.1,
    pickupScale: 0.05,
    positionOffset: { x: 0.1, y: -0.08, z: -0.35 },
    rotationOffset: { x: 0, y: Math.PI / 2, z: 0 },  // +90 deg to point forward
    muzzleFlashScale: 1.2,
    recoil: 0.004,
    glowColor: 0x4488ff   // Blue
  },
  nuke: {
    name: 'Heavy SMG',
    fireRate: 0.03,       // Extremely fast
    damage: 3,
    magAmmo: 100,
    ammoPerMag: 100,
    maxAmmo: 400,
    type: 'hitscan',      // Changed to hitscan for better gameplay
    modelKey: 'smg2',     // Maps to assets['smg2']
    modelScale: 0.12,
    pickupScale: 0.06,
    positionOffset: { x: 0.12, y: -0.1, z: -0.3 },
    rotationOffset: { x: 0, y: -Math.PI / 2, z: 0 },  // -90 deg (different model orientation)
    muzzleFlashScale: 0.6,
    recoil: 0.002,
    glowColor: 0xff4444   // Red
  }
};

// Order of weapon unlocks
export const WEAPON_TIERS = ['rifle', 'ak47', 'gatling', 'nuke'];

// Kill thresholds for each weapon tier
export const WEAPON_THRESHOLDS = [0, 3, 10, 20];

export function getWeaponConfig(weaponKey) {
  return WEAPONS[weaponKey] || WEAPONS.rifle;
}

export function getWeaponForKills(kills) {
  let tierIndex = 0;
  for (let i = WEAPON_THRESHOLDS.length - 1; i >= 0; i--) {
    if (kills >= WEAPON_THRESHOLDS[i]) {
      tierIndex = i;
      break;
    }
  }
  return WEAPON_TIERS[tierIndex];
}
