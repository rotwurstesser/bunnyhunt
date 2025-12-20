import { COLORS } from './colors';

export const RUNTIME = {
    headless: false
};

export const CONFIG = {
    // World Settings
    seed: 12347,
    worldSize: 300,
    cellSize: 3,

    // Visual Settings (Runtime)
    visual: {
        treeScale: 0.8,
        treeY: 0.0,
        grassScale: 0.6,
        grassY: 0.0,
        grassDensity: 5.0, // New slider for density (instances per tile)
        grassCoverage: 0.85, // New: Chance of grass on empty tiles
        rabbitScale: 0.6,
        rabbitY: 0.2,
        wolfScale: 0.3,
        wolfY: 0.7
    },

    // Water Generation
    waterLevel: 0.39,
    riverCount: 20,
    erosionRate: 0.1,

    // Vegetation Generation
    treeDensity: 0.05,

    grassDensity: 0.1,

    // Animal Generation
    rabbitCount: 800,
    wolfCount: 20,

    // Time settings
    tickRate: 50,

    // Time Scale Constants (1 Tick = 1 Hour)
    TICKS_PER_DAY: 24,
    DAYS_PER_YEAR: 365,

    // Environment Rules
    droughtPenalty: 0.01,

    // Organism Definitions
    ORGANISMS: {
        PLANTS: {
            Oak: {
                size: 1.0,
                color: COLORS.Plant.Oak,
                updateFrequency: 24,
                lifespan: 1752000,
                reproductionRate: 131400,
                reproductionChance: 0.005,  // Reduced from 0.05 to prevent forest takeover
                waterRange: 30,
                foodProduction: 5,
                maxEnergy: 2000,
                regenRate: 0.5
            },
            Pine: {
                size: 0.9,
                color: COLORS.Plant.Pine,
                updateFrequency: 24,
                lifespan: 1314000,
                reproductionRate: 131400,
                reproductionChance: 0.008, // Reduced from 0.08
                waterRange: 20,
                foodProduction: 5,
                maxEnergy: 2000,
                regenRate: 0.5
            },
            Grass: {
                size: 0.5,
                color: COLORS.Plant.Grass,
                updateFrequency: 1,
                lifespan: 8760,
                reproductionRate: 24,
                reproductionChance: 0.15,
                waterRange: 80,
                foodProduction: 20,
                maxEnergy: 50,
                regenRate: 1.5
            },
            AridGrass: {
                size: 0.4,
                color: COLORS.Plant.AridGrass,
                updateFrequency: 1,
                lifespan: 17520,
                reproductionRate: 48,
                reproductionChance: 0.1,
                waterRange: 120,
                foodProduction: 15,
                maxEnergy: 40,
                regenRate: 0.8
            }
        },
        ANIMALS: {
            Rabbit: {
                size: 0.6,
                color: COLORS.Animal.Rabbit,
                updateFrequency: 1,
                lifespan: 43800,
                maturityAge: 1000,    // Reduced maturity age
                reproCooldown: 500,   // Reduced cooldown
                litterSizeMin: 3,     // Increased min litter
                litterSizeMax: 6,
                energy: 100,
                metaCost: 1.0,
                babyEnergyMult: 0.33,
                babyMetaMult: 0.5,

                gain: 30,
                eatSpeed: 5,
                satietyThreshold: 0.80, // Increased threshold to encourage eating/repro

                reproductionThreshold: 0.8,
                reproductionChance: 0.05,
                vision: 5,
                speed: 1,
            },
            Wolf: {
                size: 0.8,
                color: COLORS.Animal.Wolf,
                updateFrequency: 1,
                lifespan: 105120,
                maturityAge: 8000,
                reproCooldown: 4000,
                litterSizeMin: 2,
                litterSizeMax: 5,
                energy: 250,      // Increased energy buffer slightly
                metaCost: 0.8,
                babyEnergyMult: 0.4,
                babyMetaMult: 0.6,

                gain: 80,
                eatSpeed: 0,
                satietyThreshold: 0.80,

                reproductionThreshold: 0.9,
                reproductionChance: 0.01,
                vision: 10,  // Reduced from 12
                speed: 2,    // Reduced from 3
            }
        }
    }
};