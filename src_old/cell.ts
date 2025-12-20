import { CONFIG } from './config';
import { TerrainType, GroundType } from './enums';
import { Plant } from './plant';
import { Animal } from './animal';
import { COLORS } from './colors';

export class Cell {
    x: number;
    y: number;
    height: number;
    
    // State
    terrain: TerrainType;
    ground: GroundType = GroundType.Dirt;
    plant: Plant | null = null;
    animal: Animal | null = null;
    
    distToWater: number = 999;

    constructor(x: number, y: number, height: number) {
        this.x = x;
        this.y = y;
        this.height = height;
        
        if (this.height < CONFIG.waterLevel) {
            this.terrain = TerrainType.Water;
            this.distToWater = 0;
        } else {
            this.terrain = TerrainType.Land;
        }
    }

    get isLand(): boolean {
        return this.terrain === TerrainType.Land;
    }

    setPlant(p: Plant) {
        this.plant = p;
    }

    removePlant() {
        this.plant = null;
    }

    setAnimal(a: Animal) {
        this.animal = a;
    }

    removeAnimal() {
        this.animal = null;
    }

    getColor(): string {
        // Layer 0: Animal (Top Priority)
        if (this.animal) {
            return this.animal.color;
        }

        // Layer 1: Vegetation
        if (this.plant) {
            return this.plant.color;
        }

        // Layer 2: Water
        if (this.terrain === TerrainType.Water) {
            if (this.height < CONFIG.waterLevel - 0.1) return COLORS.Terrain.DeepWater;
            return COLORS.Terrain.Water;
        }

        // Layer 3: Ground
        if (this.ground === GroundType.ForestFloor) {
            return COLORS.Terrain.ForestFloor;
        }
        
        return COLORS.Terrain.Dirt;
    }
}