// Weapon configuration for all weapon types
// For now, all weapons use the AK-47 model with different stats
// Later, we can add unique models for each weapon

export const WEAPONS = {
    rifle: {
        name: 'Hunting Rifle',
        fireRate: 0.8,        // Slow but powerful
        damage: 25,
        magAmmo: 5,
        ammoPerMag: 5,
        maxAmmo: 30,
        type: 'hitscan',
        modelScale: 0.05,
        // Visual tweaks (can adjust per weapon when models are added)
        muzzleFlashScale: 1.5,
        recoil: 0.02
    },
    ak47: {
        name: 'AK-47',
        fireRate: 0.1,        // Fast automatic
        damage: 8,
        magAmmo: 30,
        ammoPerMag: 30,
        maxAmmo: 150,
        type: 'hitscan',
        modelScale: 0.05,
        muzzleFlashScale: 1.0,
        recoil: 0.008
    },
    gatling: {
        name: 'Gatling Gun',
        fireRate: 0.04,       // Very fast
        damage: 4,
        magAmmo: 200,
        ammoPerMag: 200,
        maxAmmo: 600,
        type: 'hitscan',
        modelScale: 0.06,
        muzzleFlashScale: 0.8,
        recoil: 0.003
    },
    nuke: {
        name: 'NUKE',
        fireRate: 3.0,        // Very slow
        damage: 9999,
        magAmmo: 1,
        ammoPerMag: 1,
        maxAmmo: 1,
        type: 'projectile',
        modelScale: 0.05,
        muzzleFlashScale: 2.0,
        recoil: 0.1
    }
};

// Order of weapon unlocks
export const WEAPON_TIERS = ['rifle', 'ak47', 'gatling', 'nuke'];

// Kill thresholds for each weapon tier
export const WEAPON_THRESHOLDS = [0, 15, 30, 50];

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
