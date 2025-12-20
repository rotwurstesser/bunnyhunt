export abstract class Entity {
    tileSize: number;
    color: string;
    updateFrequency: number;
    reproductionRate: number; // For plants this acts as maturity
    reproductionChance: number;
    lifespan: number;
    // Base props
    id: number;
    static nextId = 0;

    age: number = 0;

    // Track when we last reproduced to enforce cooldowns
    lastReproductionTime: number = -99999;

    constructor(config: any) {
        this.id = Entity.nextId++;
        this.age = 0;
        this.tileSize = config.size;
        this.color = config.color;
        this.updateFrequency = config.updateFrequency || 1;
        this.reproductionRate = config.reproductionRate || 0;
        this.reproductionChance = config.reproductionChance;
        this.lifespan = config.lifespan;
    }
}