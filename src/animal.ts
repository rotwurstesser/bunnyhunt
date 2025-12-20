import { AnimalType } from './enums';
import { CONFIG } from './config';
import { World } from './world';
import { Cell } from './cell';
import { Entity } from './entity';

function mutate(val: number, variance: number = 0.1): number {
  const factor = 1 + (Math.random() * variance * 2 - variance);
  return val * factor;
}


export abstract class Animal extends Entity {
  type: AnimalType;
  hasMoved: boolean = false;

  // Config Props (Mutable)
  baseEnergy: number;
  baseMeta: number;
  eatSpeed: number;
  satietyThreshold: number; // NEW

  // Biology Props (Mutable)
  maturityAge: number;
  reproCooldown: number;
  litterMin: number;
  litterMax: number;
  babyEnergyMult: number;
  babyMetaMult: number;
  reproThreshold: number;
  reproChance: number;

  // Dynamic State
  currentEnergy: number;
  gain: number;
  vision: number;
  speed: number;

  // Static mode movement (for performance-optimized shooting gallery)
  vx: number = 0;  // Velocity X
  vy: number = 0;  // Velocity Y
  updateSlot: number = 0;  // Which tick slot this animal updates on (0-9 for time-slicing)

  constructor(type: AnimalType, config: any, parent?: Animal) {
    super(config);
    this.type = type;

    if (parent) {
      this.baseEnergy = mutate(parent.baseEnergy);
      this.baseMeta = mutate(parent.baseMeta);
      this.eatSpeed = mutate(parent.eatSpeed);
      // Mutate satiety, clamp to logical bounds (0.5 to 1.0)
      this.satietyThreshold = Math.min(1.0, Math.max(0.5, mutate(parent.satietyThreshold, 0.05)));

      this.maturityAge = config.maturityAge;
      this.reproCooldown = config.reproCooldown;
      this.litterMin = config.litterSizeMin;
      this.litterMax = config.litterSizeMax;
      this.babyEnergyMult = config.babyEnergyMult;
      this.babyMetaMult = config.babyMetaMult;
      this.reproThreshold = config.reproductionThreshold;
      this.reproChance = mutate(parent.reproChance);

      this.gain = mutate(parent.gain);
      this.vision = Math.max(1, Math.round(mutate(parent.vision)));
      this.speed = Math.max(0.1, mutate(parent.speed));
    } else {
      this.baseEnergy = config.energy;
      this.baseMeta = config.metaCost;
      this.eatSpeed = config.eatSpeed || 0;
      this.satietyThreshold = config.satietyThreshold || 0.95; // Default if missing

      this.maturityAge = config.maturityAge;
      this.reproCooldown = config.reproCooldown;
      this.litterMin = config.litterSizeMin;
      this.litterMax = config.litterSizeMax;
      this.babyEnergyMult = config.babyEnergyMult;
      this.babyMetaMult = config.babyMetaMult;
      this.reproThreshold = config.reproductionThreshold;
      this.reproChance = config.reproductionChance;

      this.gain = config.gain;
      this.vision = config.vision;
      this.speed = config.speed;
    }

    this.currentEnergy = this.getMaxEnergy();
    this.lastReproductionTime = -Math.floor(Math.random() * this.reproCooldown);
  }

  protected findClosest(candidates: Cell[], current: Cell): Cell | null {
    // Deprecated but kept for compatibility if needed, though we will replace usage
    if (candidates.length === 0) return null;
    let min = 99999;
    let best: Cell | null = null;
    for (const c of candidates) {
      const dist = Math.abs(c.x - current.x) + Math.abs(c.y - current.y);
      if (dist < min) {
        min = dist;
        best = c;
      } else if (dist === min && Math.random() < 0.5) {
        best = c;
      }
    }
    return best;
  }


  get isAdult(): boolean {
    return this.age >= this.maturityAge;
  }

  getMaxEnergy(): number {
    return this.isAdult ? this.baseEnergy : this.baseEnergy * this.babyEnergyMult;
  }

  getMetaCost(): number {
    return this.isAdult ? this.baseMeta : this.baseMeta * this.babyMetaMult;
  }

  abstract update(world: World, cell: Cell): void;
}

export class Rabbit extends Animal {
  constructor(parent?: Rabbit) {
    super(AnimalType.Rabbit, CONFIG.ORGANISMS.ANIMALS.Rabbit, parent);
  }

  update(world: World, cell: Cell): void {
    this.age++;
    this.currentEnergy -= this.getMetaCost();

    if (this.currentEnergy <= 0 || this.age > this.lifespan) {
      cell.removeAnimal();
      return;
    }

    const maxE = this.getMaxEnergy();
    if (this.currentEnergy > maxE) this.currentEnergy = maxE;

    // 2. Eat / Graze
    if (cell.plant && cell.plant.maxEnergy > 0) {
      // Use Satiety Threshold logic
      if (this.currentEnergy < maxE * this.satietyThreshold) {
        const deficit = maxE - this.currentEnergy;
        const desired = Math.min(deficit, this.eatSpeed);
        const actual = cell.plant.consume(desired);
        this.currentEnergy += actual;
        if (cell.plant.currentEnergy <= 0) cell.removePlant();
      }
    }

    // 3. Reproduce
    if (this.isAdult &&
      this.currentEnergy >= maxE * this.reproThreshold &&
      (world.time - this.lastReproductionTime) > this.reproCooldown) {

      if (world.rng.next() < this.reproChance) {
        this.reproduce(world, cell);
      }
    }

    // 4. Move
    // If satisfied, don't move to look for food
    if (cell.plant && cell.plant.currentEnergy > 0 && this.currentEnergy < maxE * this.satietyThreshold) {
      return;
    }

    this.move(world, cell);
  }

  private reproduce(world: World, cell: Cell) {
    this.currentEnergy *= 0.6;
    this.lastReproductionTime = world.time;

    const count = Math.floor(world.rng.range(this.litterMin, this.litterMax + 1));
    const neighbors = world.getNeighbors(cell.x, cell.y); // Use optimized getNeighbors
    const validSpots: Cell[] = [];
    for (let n of neighbors) {
      if (n.isLand && !n.animal) validSpots.push(n);
    }

    let babiesBorn = 0;
    for (const spot of validSpots) {
      if (babiesBorn >= count) break;
      const baby = new Rabbit(this);
      baby.age = 0;
      baby.currentEnergy = baby.getMaxEnergy();
      spot.setAnimal(baby);
      babiesBorn++;
    }
  }

  private move(world: World, cell: Cell) {
    // Optimization: Use getNeighbors (8) instead of InRadius(1)
    const neighbors = world.getNeighbors(cell.x, cell.y);
    const validMoves: Cell[] = [];
    for (let n of neighbors) {
      if (n.isLand && !n.animal) validMoves.push(n);
    }

    if (validMoves.length > 0) {
      let target: Cell | null = null;
      // Use Satiety Threshold logic for seeking behavior
      if (this.currentEnergy < this.getMaxEnergy() * this.satietyThreshold) {
        // Optimized search
        target = world.findClosestCell(cell.x, cell.y, this.vision, (c) => {
          return !!(c.plant && c.plant.maxEnergy > 0 && c.plant.currentEnergy > 5 && !c.animal);
        });

        // If target found, we need to pick the best move towards it
        if (target) {
          let bestDist = 9999;
          let bestMove = null;
          for (const m of validMoves) {
            const dist = Math.abs(m.x - target.x) + Math.abs(m.y - target.y);
            if (dist < bestDist) {
              bestDist = dist;
              bestMove = m;
            } else if (dist === bestDist && world.rng.next() < 0.5) {
              bestMove = m;
            }
          }
          target = bestMove;
        }
      }

      if (!target) {
        target = validMoves[Math.floor(world.rng.next() * validMoves.length)];
      }

      if (target) {
        cell.removeAnimal();
        target.setAnimal(this);
        this.hasMoved = true;
      }
    }
  }
}

export class Wolf extends Animal {
  constructor(parent?: Wolf) {
    super(AnimalType.Wolf, CONFIG.ORGANISMS.ANIMALS.Wolf, parent);
  }

  update(world: World, cell: Cell): void {
    this.age++;
    this.currentEnergy -= this.getMetaCost();

    if (this.currentEnergy <= 0 || this.age > this.lifespan) {
      cell.removeAnimal();
      return;
    }

    const maxE = this.getMaxEnergy();
    if (this.currentEnergy > maxE) this.currentEnergy = maxE;

    // Hunt Logic using Satiety Threshold
    if (this.currentEnergy < maxE * this.satietyThreshold) {
      // Check immediate range for attack (Speed is range)
      const range = Math.floor(this.speed);
      // We can check neighbors in range. Simple scan or spiral.
      // But we likely want the closest prey first.
      const prey = world.findClosestCell(cell.x, cell.y, this.vision, (c) => {
        return !!(c.animal && c.animal.type === AnimalType.Rabbit);
      });

      if (prey) {
        const dist = Math.abs(prey.x - cell.x) + Math.abs(prey.y - cell.y);
        if (dist <= range) {
          prey.removeAnimal();
          this.currentEnergy += this.gain;

          // Visual Effect
          world.events.push({ type: 'kill', x: prey.x, y: prey.y });

          cell.removeAnimal();
          prey.setAnimal(this);
          this.hasMoved = true;

          this.checkReproduction(world, prey);
          return;
        }

        // Chase
        if (!this.hasMoved) {
          const neighbors = world.getNeighbors(cell.x, cell.y);
          let bestMove = null;
          let bestDist = 9999;

          // Helper: get valid moves
          const validMoves: Cell[] = [];
          for (let n of neighbors) {
            if (n.isLand && !n.animal) validMoves.push(n);
          }

          if (validMoves.length > 0) {
            for (let m of validMoves) {
              const d = Math.abs(m.x - prey.x) + Math.abs(m.y - prey.y);
              if (d < bestDist) {
                bestDist = d;
                bestMove = m;
              } else if (d === bestDist && world.rng.next() < 0.5) {
                bestMove = m;
              }
            }

            if (bestMove) {
              cell.removeAnimal();
              bestMove.setAnimal(this);
              this.hasMoved = true;
              this.checkReproduction(world, bestMove);
              return;
            }
          }
        }
      }
    }

    if (!this.hasMoved) {
      const neighbors = world.getNeighbors(cell.x, cell.y);
      const validMoves: Cell[] = [];
      for (const n of neighbors) {
        if (n.isLand && !n.animal) validMoves.push(n);
      }

      if (validMoves.length > 0) {
        // Spread logic: prefer spots not near other wolves
        const uncrowded = validMoves.filter(n => {
          const adj = world.getNeighbors(n.x, n.y);
          return !adj.some(a => a.animal && a.animal.type === AnimalType.Wolf && a.animal !== this);
        });

        let target = null;
        if (uncrowded.length > 0) {
          target = uncrowded[Math.floor(world.rng.next() * uncrowded.length)];
        } else {
          target = validMoves[Math.floor(world.rng.next() * validMoves.length)];
        }

        if (target) {
          cell.removeAnimal();
          target.setAnimal(this);
          this.hasMoved = true;
          this.checkReproduction(world, target);
        }
      }
    }
  }

  private checkReproduction(world: World, cell: Cell) {
    const maxE = this.getMaxEnergy();
    if (this.isAdult &&
      this.currentEnergy >= maxE * this.reproThreshold &&
      (world.time - this.lastReproductionTime) > this.reproCooldown) {

      if (world.rng.next() < this.reproChance) {
        this.reproduce(world, cell);
      }
    }
  }

  private reproduce(world: World, cell: Cell) {
    this.currentEnergy *= 0.6;
    this.lastReproductionTime = world.time;

    const count = Math.floor(world.rng.range(this.litterMin, this.litterMax + 1));
    const neighbors = world.getNeighbors(cell.x, cell.y);
    const validSpots: Cell[] = [];
    for (let n of neighbors) {
      if (n.isLand && !n.animal) validSpots.push(n);
    }

    let babiesBorn = 0;
    for (const spot of validSpots) {
      if (babiesBorn >= count) break;
      const baby = new Wolf(this);
      baby.age = 0;
      baby.currentEnergy = baby.getMaxEnergy();
      spot.setAnimal(baby);
      babiesBorn++;
    }
  }
}
