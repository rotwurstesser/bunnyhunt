import { PlantType } from './enums';
import { CONFIG, RUNTIME } from './config';
import { World } from './world';
import { Cell } from './cell';
import { Entity } from './entity';

export abstract class Plant extends Entity {
    type: PlantType;
    waterRange: number;

    // Food/Energy State
    maxEnergy: number;
    currentEnergy: number;
    regenRate: number;
    baseColor: string;
    isBurnt: boolean = false;

    // Random offset to prevent all plants updating on the exact same tick
    offset: number;

    constructor(type: PlantType, config: any) {
        super(config);
        this.type = type;
        this.waterRange = config.waterRange;

        this.maxEnergy = config.maxEnergy || 0;
        this.currentEnergy = this.maxEnergy;
        this.regenRate = config.regenRate || 0;
        this.baseColor = config.color;

        this.offset = Math.floor(Math.random() * this.updateFrequency);
    }

    abstract update(world: World, cell: Cell): void;

    // Returns actual amount consumed
    consume(amount: number): number {
        if (this.currentEnergy <= 0) return 0;

        const actual = Math.min(amount, this.currentEnergy);
        this.currentEnergy -= actual;

        // Update color immediately for feedback
        this.updateColor();

        return actual;
    }

    protected updateColor() {
        if (RUNTIME.headless) return;
        if (this.maxEnergy <= 0) return; // Trees don't change color

        const ratio = this.currentEnergy / this.maxEnergy;

        // Interpolate between DEAD_COLOR (Grayish) and BASE_COLOR
        // Simple linear interpolation for RGB
        // Dead Color: #889988 (Approx 136, 153, 136)

        // Parse Base Color
        const r2 = parseInt(this.baseColor.slice(1, 3), 16);
        const g2 = parseInt(this.baseColor.slice(3, 5), 16);
        const b2 = parseInt(this.baseColor.slice(5, 7), 16);

        // Dead Color components
        const r1 = 136;
        const g1 = 153;
        const b1 = 136;

        const r = Math.round(r1 + (r2 - r1) * ratio);
        const g = Math.round(g1 + (g2 - g1) * ratio);
        const b = Math.round(b1 + (b2 - b1) * ratio);

        this.color = `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
    }

    protected checkSurvival(cell: Cell): boolean {
        const stress = Math.max(0, cell.distToWater - this.waterRange);
        const deathChance = 0.0005 + (stress * CONFIG.droughtPenalty);
        return Math.random() > deathChance;
    }

    protected shouldUpdate(world: World): boolean {
        return (world.time + this.offset) % this.updateFrequency === 0;
    }
}

export class Grass extends Plant {
    constructor(isArid: boolean = false) {
        const type = isArid ? PlantType.AridGrass : PlantType.Grass;
        const conf = isArid ? CONFIG.ORGANISMS.PLANTS.AridGrass : CONFIG.ORGANISMS.PLANTS.Grass;
        super(type, conf);
    }

    update(world: World, cell: Cell): void {
        this.age += this.updateFrequency;

        // 1. Regeneration logic (Runs every tick since updateFreq is 1 for grass now)
        if (this.currentEnergy < this.maxEnergy) {
            this.currentEnergy += this.regenRate;
            if (this.currentEnergy > this.maxEnergy) this.currentEnergy = this.maxEnergy;
            this.updateColor();
        } else if (this.currentEnergy <= 0) {
            // Plant dies if fully eaten (or maybe we leave roots? User said "replaced by none")
            cell.removePlant();
            return;
        }

        // 2. Survival
        const survivedDrought = this.checkSurvival(cell);
        if (this.age > this.lifespan || !survivedDrought) {
            if (!survivedDrought || Math.random() > 0.05) {
                cell.removePlant();
                return;
            }
        }

        // 3. Spread (Only if healthy)
        // Only spread if we have > 50% energy
        if (this.currentEnergy > this.maxEnergy * 0.5) {
            const stress = Math.max(0, cell.distToWater - this.waterRange);
            // Reduced spread chance because we update every tick now
            // Original chance was 0.15 per 12 ticks. Now 1 tick. 
            // Scaled down approx: 0.15 / 12 ~= 0.0125
            const baseChance = (this.reproductionChance / 12);
            const effectiveSpread = baseChance - (stress * CONFIG.droughtPenalty);

            // Using reproductionRate (24 hours) as maturity check
            if (this.age >= this.reproductionRate && Math.random() < effectiveSpread) {
                const neighbors = world.getNeighbors(cell.x, cell.y);
                const target = neighbors[Math.floor(Math.random() * neighbors.length)];

                if (target && target.isLand && !target.plant) {
                    const range = (this.type === PlantType.AridGrass)
                        ? CONFIG.ORGANISMS.PLANTS.AridGrass.waterRange
                        : CONFIG.ORGANISMS.PLANTS.Grass.waterRange;

                    if (target.distToWater <= range + 5) {
                        target.setPlant(new Grass(this.type === PlantType.AridGrass));
                    }
                }
            }
        }
    }
}

export class Tree extends Plant {
    constructor(type: PlantType) {
        const conf = (type === PlantType.Oak) ? CONFIG.ORGANISMS.PLANTS.Oak : CONFIG.ORGANISMS.PLANTS.Pine;
        super(type, conf);
    }

    update(world: World, cell: Cell): void {
        this.age += this.updateFrequency;
        if (!this.shouldUpdate(world)) return;

        // Trees don't really get eaten in this sim, so simple logic
        const survivedDrought = this.checkSurvival(cell);
        if (this.age > this.lifespan || !survivedDrought) {
            if (!survivedDrought || Math.random() < 0.05) {
                cell.removePlant();
                return;
            }
        }

        const stress = Math.max(0, cell.distToWater - this.waterRange);
        const effectiveSpread = this.reproductionChance - (stress * CONFIG.droughtPenalty);

        if (this.age > this.reproductionRate && Math.random() < effectiveSpread) {
            this.tryReproduce(world, cell);
        }
    }

    private tryReproduce(world: World, cell: Cell) {
        const range = 6;
        for (let i = 0; i < 15; i++) {
            const dx = Math.floor(Math.random() * (range * 2 + 1)) - range;
            const dy = Math.floor(Math.random() * (range * 2 + 1)) - range;
            const targetX = cell.x + dx;
            const targetY = cell.y + dy;

            if (world.isValid(targetX, targetY)) {
                const target = world.cells[targetY][targetX];
                if (target.isLand && !target.plant) {
                    if (target.distToWater > this.waterRange + 10) continue;
                    target.setPlant(new Tree(this.type));
                    return;
                }
            }
        }
    }
}