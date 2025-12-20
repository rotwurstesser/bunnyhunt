// Top of file
import { CONFIG, RUNTIME } from './config';
import { Cell } from './cell';
import { SeededRandom, SimpleNoise } from './helper';
import { TerrainType, GroundType, PlantType, AnimalType } from './enums';
import { Tree, Grass, Plant } from './plant';
import { Rabbit, Wolf, Animal } from './animal';

const DIRS = [[0, 1], [0, -1], [1, 0], [-1, 0], [1, 1], [-1, -1], [1, -1], [-1, 1]];

// Event System
export interface GameEvent {
  type: 'kill';
  x: number;
  y: number;
}

export class World {
  // ...
  public events: GameEvent[] = [];

  width: number;
  height: number;
  cells: Cell[][];
  rng: SeededRandom;
  time: number = 0;

  constructor(size: number, seed: number) {
    this.width = size;
    this.height = size;
    this.rng = new SeededRandom(seed);
    this.cells = [];
    this.generate();
  }

  private generate() {
    // ... (unchanged)
    const noise = new SimpleNoise(this.rng);
    const scale = 0.02;

    // 1. Terrain
    for (let y = 0; y < this.height; y++) {
      const row: Cell[] = [];
      for (let x = 0; x < this.width; x++) {
        let h = noise.get(x * scale, y * scale) * 1;
        h += noise.get(x * scale * 5 + 100, y * scale * 5 + 100) * 0.15;
        h = h / 1.15;
        row.push(new Cell(x, y, h));
      }
      this.cells.push(row);
    }

    // 2. Features
    for (let i = 0; i < CONFIG.riverCount; i++) this.createRiver();
    this.cleanupWater();
    this.calculateMoisture();

    // 3. Life
    this.seedLife();
    this.seedAnimals();
  }

  // ... (unchanged helpers)


  private seedAnimals() {
    for (let i = 0; i < CONFIG.rabbitCount; i++) this.spawnRandomAnimal(new Rabbit());
    for (let i = 0; i < CONFIG.wolfCount; i++) this.spawnRandomAnimal(new Wolf());
  }

  private spawnRandomAnimal(animal: Animal) {
    let attempts = 0;
    while (attempts < 50) {
      const x = Math.floor(this.rng.range(0, this.width));
      const y = Math.floor(this.rng.range(0, this.height));
      const cell = this.cells[y][x];

      if (cell.isLand && !cell.animal) {
        animal.age = Math.floor(this.rng.range(0, animal.lifespan * 0.6));
        animal.currentEnergy = animal.getMaxEnergy();
        cell.setAnimal(animal);
        break;
      }
      attempts++;
    }
  }

  private seedLife() {
    const forestNoise = new SimpleNoise(this.rng);
    const forestScale = 0.04;
    const treeDens = CONFIG.treeDensity;
    const grassDens = CONFIG.grassDensity;
    const conf = CONFIG.ORGANISMS.PLANTS;

    for (let y = 0; y < this.height; y++) {
      for (let x = 0; x < this.width; x++) {
        const cell = this.cells[y][x];
        if (!cell.isLand) continue;
        if (cell.distToWater > conf.AridGrass.waterRange + 10) continue;

        const fVal = forestNoise.get((x + 5000) * forestScale, (y + 5000) * forestScale);
        const rand = this.rng.next();

        let plant: Plant | null = null;
        let potentialType: PlantType = PlantType.None;

        if (fVal > 0.4) {
          if (rand < treeDens * 14) potentialType = (rand < 0.5 ? PlantType.Oak : PlantType.Pine);
          else cell.ground = GroundType.ForestFloor;
        }
        else if (fVal > 0.0) {
          if (rand < treeDens * 4) potentialType = PlantType.Oak;
          else if (rand < treeDens * 4 + (grassDens * 2)) potentialType = PlantType.Grass;
        }
        else {
          if (rand < treeDens * 0.1) potentialType = PlantType.Oak;
          else if (rand < grassDens) potentialType = PlantType.Grass;
        }

        if (potentialType === PlantType.Oak) {
          if (cell.distToWater <= conf.Oak.waterRange) plant = new Tree(PlantType.Oak);
          else if (cell.distToWater <= conf.AridGrass.waterRange && rand < 0.1) plant = new Grass(true);
        }
        else if (potentialType === PlantType.Pine) {
          if (cell.distToWater <= conf.Pine.waterRange) plant = new Tree(PlantType.Pine);
          else if (cell.distToWater <= conf.AridGrass.waterRange && rand < 0.1) plant = new Grass(true);
        }
        else if (potentialType === PlantType.Grass) {
          if (cell.distToWater <= conf.Grass.waterRange) plant = new Grass(false);
          else if (cell.distToWater <= conf.AridGrass.waterRange) plant = new Grass(true);
        }
        else if (cell.distToWater > conf.Grass.waterRange && cell.distToWater <= conf.AridGrass.waterRange) {
          if (rand < 0.05) plant = new Grass(true);
        }

        if (plant) {
          plant.age = Math.floor(this.rng.range(0, (plant as any).lifespan || 50));
          cell.setPlant(plant);
        }
      }
    }
  }

  killAnimal(id: number) {
    for (let y = 0; y < this.height; y++) {
      for (let x = 0; x < this.width; x++) {
        if (this.cells[y][x].animal && this.cells[y][x].animal!.id === id) {
          this.cells[y][x].animal = null;
          return;
        }
      }
    }
  }

  tick() {
    this.time++;
    this.events = []; // Clear events from previous tick

    for (let y = 0; y < this.height; y++) {
      for (let x = 0; x < this.width; x++) {
        if (this.cells[y][x].animal) {
          this.cells[y][x].animal!.hasMoved = false;
        }
      }
    }

    // ... rest of tick

    for (let y = 0; y < this.height; y++) {
      for (let x = 0; x < this.width; x++) {
        const cell = this.cells[y][x];

        if (cell.plant) cell.plant.update(this, cell);
        if (cell.animal && !cell.animal.hasMoved) cell.animal.update(this, cell);
        if (!RUNTIME.headless && cell.isLand) this.updateGroundCover(cell);
      }
    }
  }

  // Optimized neighbor check for ground cover
  private updateGroundCover(cell: Cell) {
    if (cell.plant instanceof Tree) {
      cell.ground = GroundType.ForestFloor;
      return;
    }
    let treeCount = 0;
    // Inline neighbor check to avoid array allocation
    const cx = cell.x;
    const cy = cell.y;

    for (let i = 0; i < 8; i++) {
      const nx = cx + DIRS[i][0];
      const ny = cy + DIRS[i][1];
      if (this.isValid(nx, ny)) {
        if (this.cells[ny][nx].plant instanceof Tree) treeCount++;
      }
    }

    if (treeCount >= 2) {
      cell.ground = GroundType.ForestFloor;
    } else if (cell.ground === GroundType.ForestFloor) {
      if (Math.random() < 0.05) cell.ground = GroundType.Dirt;
    } else {
      cell.ground = GroundType.Dirt;
    }
  }

  getStats() {
    let oak = 0, pine = 0, grass = 0, arid = 0, rabbit = 0, wolf = 0;
    for (let y = 0; y < this.height; y++) {
      for (let x = 0; x < this.width; x++) {
        const cell = this.cells[y][x];
        const p = cell.plant;
        if (p) {
          if (p.type === PlantType.Oak) oak++;
          else if (p.type === PlantType.Pine) pine++;
          else if (p.type === PlantType.Grass) grass++;
          else if (p.type === PlantType.AridGrass) arid++;
        }
        const a = cell.animal;
        if (a) {
          if (a.type === AnimalType.Rabbit) rabbit++;
          else if (a.type === AnimalType.Wolf) wolf++;
        }
      }
    }
    return { oak, pine, grass, arid, rabbit, wolf };
  }

  isValid(x: number, y: number): boolean {
    return x >= 0 && x < this.width && y >= 0 && y < this.height;
  }

  getNeighbors(x: number, y: number): Cell[] {
    const results: Cell[] = [];
    for (let i = 0; i < 8; i++) {
      const nx = x + DIRS[i][0];
      const ny = y + DIRS[i][1];
      if (this.isValid(nx, ny)) results.push(this.cells[ny][nx]);
    }
    return results;
  }

  getNeighborsInRadius(cx: number, cy: number, r: number): Cell[] {
    const results: Cell[] = [];
    for (let y = cy - r; y <= cy + r; y++) {
      for (let x = cx - r; x <= cx + r; x++) {
        if (x === cx && y === cy) continue;
        if (this.isValid(x, y)) results.push(this.cells[y][x]);
      }
    }
    return results;
  }

  // Allocation-free search for closest entity matching predicate
  findClosestCell(cx: number, cy: number, r: number, predicate: (c: Cell) => boolean): Cell | null {
    // let closest: Cell | null = null;
    let minDist = 999999;
    const candidates: Cell[] = []; // Only for same-distance selection if needed, or we just pick first/random

    // Optimization: Spiral search or just scan. Scan is O(R^2).
    // To be truly random among equals, we need to collect them.
    // But if we just want "a" closest, we can pick the first one we find at min dist?
    // The original logic did random among closest.

    for (let y = cy - r; y <= cy + r; y++) {
      for (let x = cx - r; x <= cx + r; x++) {
        if (x === cx && y === cy) continue;
        if (!this.isValid(x, y)) continue;

        const cell = this.cells[y][x];
        if (predicate(cell)) {
          const dist = Math.abs(x - cx) + Math.abs(y - cy);
          if (dist < minDist) {
            minDist = dist;
            // closest = cell; // Remove dead code
            candidates.length = 0;
            candidates.push(cell);
          } else if (dist === minDist) {
            candidates.push(cell);
          }
        }
      }
    }

    if (candidates.length === 0) return null;
    if (candidates.length === 1) return candidates[0];
    return candidates[Math.floor(this.rng.range(0, candidates.length))];
  }

  private createRiver() {
    let sx = Math.floor(this.rng.range(0, this.width));
    let sy = Math.floor(this.rng.range(0, this.height));
    let cell = this.cells[sy][sx];

    if (!cell.isLand) return;
    let current = cell;
    while (true) {
      current.terrain = TerrainType.Water;
      current.distToWater = 0;
      current.height = CONFIG.waterLevel - 0.05;
      let neighbors = this.getNeighbors(current.x, current.y);
      let lowest = current;
      for (let n of neighbors) {
        if (n.height < lowest.height) lowest = n;
      }
      if (lowest === current || !lowest.isLand) break;
      current = lowest;
    }
  }

  private cleanupWater() {
    const iterations = 3;
    for (let i = 0; i < iterations; i++) {
      for (let y = 0; y < this.height; y++) {
        for (let x = 0; x < this.width; x++) {
          const cell = this.cells[y][x];
          const neighbors = this.getNeighbors(cell.x, cell.y);
          let waterCount = 0;
          neighbors.forEach(n => { if (!n.isLand) waterCount++; });
          if (!cell.isLand && waterCount < 3) {
            cell.terrain = TerrainType.Land;
            cell.height = CONFIG.waterLevel + 0.05;
          } else if (cell.isLand && waterCount > 5) {
            cell.terrain = TerrainType.Water;
            cell.height = CONFIG.waterLevel - 0.05;
          }
        }
      }
    }
  }

  private calculateMoisture() {
    const queue: Cell[] = [];
    for (let y = 0; y < this.height; y++) {
      for (let x = 0; x < this.width; x++) {
        const cell = this.cells[y][x];
        if (!cell.isLand) {
          cell.distToWater = 0;
          queue.push(cell);
        } else {
          cell.distToWater = 999;
        }
      }
    }
    while (queue.length > 0) {
      const current = queue.shift()!;
      const neighbors = this.getNeighbors(current.x, current.y);
      for (const n of neighbors) {
        if (n.distToWater === 999) {
          n.distToWater = current.distToWater + 1;
          queue.push(n);
        }
      }
    }
  }
}
