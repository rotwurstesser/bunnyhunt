/**
 * Spawn Manager Component
 *
 * Manages spawning/respawning of animals and weapon pickups.
 */

import * as THREE from 'three';
import { SkeletonUtils } from 'three/examples/jsm/utils/SkeletonUtils';
import Component from '../../core/Component';
import Entity from '../../core/Entity';
import RabbitController from '../Animals/RabbitController';
import FoxController from '../Animals/FoxController';
import TRexController from '../Animals/TRexController';
import ApatosaurusController from '../Animals/ApatosaurusController';
import NukeProjectile from '../Player/NukeProjectile';
import WeaponPickup from '../Pickups/WeaponPickup';
import type { AnimalDiedEvent, NukeFiredEvent, NukeDetonatedEvent, FoxWeaponDropEvent } from '../../types/events.types';
import type { IEntity } from '../../types/entity.types';

// ============================================================================
// TYPES
// ============================================================================

/** Navmesh interface */
interface NavmeshComponent {
  GetRandomNode(position: THREE.Vector3, range: number): THREE.Vector3 | null;
}

/** Entity Manager interface */
interface EntityManagerInterface {
  Add(entity: Entity): void;
  Remove(entity: Entity): void;
}

/** Respawn queue item */
interface RespawnItem {
  type: 'rabbit' | 'fox' | 'trex' | 'apatosaurus';
  timer: number;
  position: THREE.Vector3;
}

/** Asset dictionary */
type AssetDict = Record<string, THREE.Object3D & { scene?: THREE.Object3D; animations?: THREE.AnimationClip[] }>;

// ============================================================================
// SPAWN MANAGER COMPONENT
// ============================================================================

export default class SpawnManager extends Component {
  override name = 'SpawnManager';

  // ============================================================================
  // DEPENDENCIES
  // ============================================================================

  private readonly scene: THREE.Scene;
  private readonly physicsWorld: unknown;
  private readonly assets: AssetDict;

  // ============================================================================
  // CONFIGURATION
  // ============================================================================

  private readonly maxRabbits: number = 12;
  private readonly maxFoxes: number = 2;
  private readonly maxTrex: number = 1;
  private readonly maxApatosaurus: number = 2;
  private readonly respawnCooldown: number = 5;
  private readonly trexSpawnChance: number = 0.25; // 25% chance

  // ============================================================================
  // STATE
  // ============================================================================

  /** Active rabbit entities */
  private rabbits: Entity[] = [];

  /** Active fox entities */
  private foxes: Entity[] = [];

  public GetRabbits(): Entity[] {
    return this.rabbits;
  }

  public GetFoxes(): Entity[] {
    return this.foxes;
  }

  /** Active T-Rex entities */
  private trexes: Entity[] = [];

  /** Active Apatosaurus entities */
  private apatosauruses: Entity[] = [];

  /** Pending respawns */
  private respawnQueue: RespawnItem[] = [];

  /** Whether initial spawn is complete */
  public initialSpawnComplete: boolean = false;

  // ============================================================================
  // REFERENCES
  // ============================================================================

  private navmesh: NavmeshComponent | null = null;
  private entityManager: EntityManagerInterface | null = null;

  // ============================================================================
  // CONSTRUCTOR
  // ============================================================================

  constructor(scene: THREE.Scene, physicsWorld: unknown, assets: AssetDict) {
    super();
    this.scene = scene;
    this.physicsWorld = physicsWorld;
    this.assets = assets;
  }

  // ============================================================================
  // INITIALIZATION
  // ============================================================================

  override Initialize(): void {
    const level = this.FindEntity('Level');
    this.navmesh = level?.GetComponent('Navmesh') as NavmeshComponent | undefined ?? null;
    this.entityManager = this.parent?.parent as EntityManagerInterface | undefined ?? null;

    // Listen for events
    this.parent!.RegisterEventHandler(this.onAnimalDied, 'animal_died');
    this.parent!.RegisterEventHandler(this.onNukeDetonated, 'nuke_detonated');
    this.parent!.RegisterEventHandler(this.onNukeFired, 'nuke_fired');
    this.parent!.RegisterEventHandler(this.onFoxWeaponDrop, 'fox_weapon_drop');
  }

  // ============================================================================
  // SPAWN POSITION
  // ============================================================================

  GetRandomSpawnPosition(): THREE.Vector3 {
    const minDistFromCenter = 8;
    const maxDist = 30;

    const angle = Math.random() * Math.PI * 2;
    const distance = minDistFromCenter + Math.random() * (maxDist - minDistFromCenter);

    const x = Math.cos(angle) * distance;
    const z = Math.sin(angle) * distance;
    const spawnY = 0.5;

    // Try navmesh first
    try {
      const targetPos = new THREE.Vector3(x, spawnY, z);
      const node = this.navmesh?.GetRandomNode(targetPos, 10);
      if (node) {
        node.y = spawnY;
        return node;
      }
    } catch (e) {
      // Navmesh failed, use fallback
    }

    return new THREE.Vector3(x, spawnY, z);
  }

  // ============================================================================
  // RABBIT SPAWNING
  // ============================================================================

  SpawnRabbit(): Entity | null {
    if (this.rabbits.length >= this.maxRabbits) return null;

    const position = this.GetRandomSpawnPosition();
    const entity = this.createRabbitEntity(position);

    if (entity && this.entityManager) {
      this.entityManager.Add(entity);

      if (this.initialSpawnComplete) {
        this.initializeEntity(entity);
      }

      this.rabbits.push(entity);
    }

    return entity;
  }

  private createRabbitEntity(position: THREE.Vector3): Entity | null {
    const rabbitModel = this.assets['rabbit'];
    if (!rabbitModel) {
      console.error('Rabbit model not loaded');
      return null;
    }

    const sourceScene = rabbitModel.scene || rabbitModel;
    const modelClone = SkeletonUtils.clone(sourceScene) as THREE.Object3D;

    if (rabbitModel.animations && rabbitModel.animations.length > 0) {
      (modelClone as { animations?: THREE.AnimationClip[] }).animations = rabbitModel.animations;
    }

    const entity = new Entity();
    entity.SetName(`Rabbit_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`);
    entity.SetPosition(position);
    entity.AddComponent(new RabbitController(modelClone, this.scene, this.physicsWorld));

    return entity;
  }

  // ============================================================================
  // FOX SPAWNING
  // ============================================================================

  SpawnFox(): Entity | null {
    if (this.foxes.length >= this.maxFoxes) return null;

    const position = this.GetRandomSpawnPosition();
    const entity = this.createFoxEntity(position);

    if (entity && this.entityManager) {
      this.entityManager.Add(entity);

      if (this.initialSpawnComplete) {
        this.initializeEntity(entity);
      }

      this.foxes.push(entity);
    }

    return entity;
  }

  private createFoxEntity(position: THREE.Vector3): Entity | null {
    const foxModel = this.assets['fox'];
    if (!foxModel) {
      console.error('Fox model not loaded');
      return null;
    }

    const sourceScene = foxModel.scene || foxModel;
    const modelClone = SkeletonUtils.clone(sourceScene) as THREE.Object3D;

    if (foxModel.animations && foxModel.animations.length > 0) {
      (modelClone as { animations?: THREE.AnimationClip[] }).animations = foxModel.animations;
    }

    const entity = new Entity();
    entity.SetName(`Fox_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`);
    entity.SetPosition(position);
    entity.AddComponent(new FoxController(modelClone, this.scene, this.physicsWorld));

    return entity;
  }

  // ============================================================================
  // T-REX SPAWNING
  // ============================================================================

  SpawnTRex(): Entity | null {
    if (this.trexes.length >= this.maxTrex) return null;

    const position = this.GetRandomSpawnPosition();
    const entity = this.createTRexEntity(position);

    if (entity && this.entityManager) {
      this.entityManager.Add(entity);

      if (this.initialSpawnComplete) {
        this.initializeEntity(entity);
      }

      this.trexes.push(entity);
    }

    return entity;
  }

  private createTRexEntity(position: THREE.Vector3): Entity | null {
    const trexModel = this.assets['trex'];
    if (!trexModel) {
      console.error('T-Rex model not loaded');
      return null;
    }

    const modelClone = SkeletonUtils.clone(trexModel) as THREE.Object3D;

    if (trexModel.animations && trexModel.animations.length > 0) {
      (modelClone as { animations?: THREE.AnimationClip[] }).animations = trexModel.animations;
    }

    const entity = new Entity();
    entity.SetName(`TRex_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`);
    entity.SetPosition(position);
    entity.AddComponent(new TRexController(modelClone, this.scene, this.physicsWorld));

    return entity;
  }

  // ============================================================================
  // APATOSAURUS SPAWNING
  // ============================================================================

  SpawnApatosaurus(): Entity | null {
    if (this.apatosauruses.length >= this.maxApatosaurus) return null;

    const position = this.GetRandomSpawnPosition();
    const entity = this.createApatosaurusEntity(position);

    if (entity && this.entityManager) {
      this.entityManager.Add(entity);

      if (this.initialSpawnComplete) {
        this.initializeEntity(entity);
      }

      this.apatosauruses.push(entity);
    }

    return entity;
  }

  private createApatosaurusEntity(position: THREE.Vector3): Entity | null {
    const apatosaurusModel = this.assets['apatosaurus'];
    if (!apatosaurusModel) {
      console.error('Apatosaurus model not loaded');
      return null;
    }

    const modelClone = SkeletonUtils.clone(apatosaurusModel) as THREE.Object3D;

    if (apatosaurusModel.animations && apatosaurusModel.animations.length > 0) {
      (modelClone as { animations?: THREE.AnimationClip[] }).animations = apatosaurusModel.animations;
    }

    const entity = new Entity();
    entity.SetName(`Apatosaurus_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`);
    entity.SetPosition(position);
    entity.AddComponent(new ApatosaurusController(modelClone, this.scene, this.physicsWorld));

    return entity;
  }

  // ============================================================================
  // WEAPON PICKUP
  // ============================================================================

  SpawnWeaponPickup(position: THREE.Vector3, weaponKey: string): Entity {
    const weaponAssets = {
      pistol: this.assets['pistol'],
      smg: this.assets['smg'],
      assaultRifle: this.assets['assaultRifle'],
      smg2: this.assets['smg2'],
    };

    const entity = new Entity();
    entity.SetName(`WeaponDrop_${weaponKey}_${Date.now()}`);
    entity.SetPosition(position);
    entity.AddComponent(new WeaponPickup(this.scene, weaponKey, position, weaponAssets));

    if (this.entityManager) {
      this.entityManager.Add(entity);
      this.initializeEntity(entity);
    }

    return entity;
  }

  // ============================================================================
  // ENTITY HELPERS
  // ============================================================================

  private initializeEntity(entity: Entity): void {
    for (const key in entity.components) {
      entity.components[key].Initialize();
    }
  }

  private cleanupEntity(entity: Entity): void {
    const controller = entity.GetComponent('RabbitController') ??
      entity.GetComponent('FoxController') ??
      entity.GetComponent('TRexController') ??
      entity.GetComponent('ApatosaurusController');

    if (controller && typeof (controller as { Cleanup?: () => void }).Cleanup === 'function') {
      (controller as { Cleanup: () => void }).Cleanup();
    }

    this.entityManager?.Remove(entity);
  }

  // ============================================================================
  // EVENT HANDLERS
  // ============================================================================

  private onAnimalDied = (msg: AnimalDiedEvent): void => {
    // Remove from active list
    if (msg.type === 'rabbit') {
      this.rabbits = this.rabbits.filter((r) => r !== msg.entity);
    } else if (msg.type === 'fox') {
      this.foxes = this.foxes.filter((f) => f !== msg.entity);
    } else if (msg.type === 'trex') {
      this.trexes = this.trexes.filter((t) => t !== msg.entity);
    } else if (msg.type === 'apatosaurus') {
      this.apatosauruses = this.apatosauruses.filter((a) => a !== msg.entity);
    }

    // Queue respawn
    this.respawnQueue.push({
      type: msg.type as 'rabbit' | 'fox' | 'trex' | 'apatosaurus',
      timer: this.respawnCooldown,
      position: msg.position,
    });

    // Schedule entity cleanup
    setTimeout(() => {
      this.cleanupEntity(msg.entity as Entity);
    }, 6000);
  };

  private onFoxWeaponDrop = (msg: FoxWeaponDropEvent): void => {
    const roll = Math.random();
    let weaponKey = 'ak47';
    if (roll < 0.15) {
      weaponKey = 'nuke';
    } else if (roll < 0.50) {
      weaponKey = 'gatling';
    }

    this.SpawnWeaponPickup(msg.position, weaponKey);
  };

  private onNukeFired = (msg: NukeFiredEvent): void => {
    const nukeEntity = new Entity();
    nukeEntity.SetName(`Nuke_${Date.now()}`);
    nukeEntity.SetPosition(msg.startPosition);
    nukeEntity.AddComponent(new NukeProjectile(this.scene, msg.startPosition, msg.direction));

    if (this.entityManager) {
      this.entityManager.Add(nukeEntity);
      this.initializeEntity(nukeEntity);
    }
  };

  private onNukeDetonated = (_msg: NukeDetonatedEvent): void => {
    const allAnimals = [...this.rabbits, ...this.foxes, ...this.trexes, ...this.apatosauruses];
    allAnimals.forEach((animal) => {
      const controller = animal.GetComponent('RabbitController') ??
        animal.GetComponent('FoxController') ??
        animal.GetComponent('TRexController') ??
        animal.GetComponent('ApatosaurusController');
      if (controller && !(controller as { isDead?: boolean }).isDead) {
        (controller as { TakeHit: (msg: { amount: number }) => void }).TakeHit({ amount: 9999 });
      }
    });
  };

  // ============================================================================
  // UPDATE
  // ============================================================================

  override Update(deltaTime: number): void {
    // Process respawn queue
    for (let i = this.respawnQueue.length - 1; i >= 0; i--) {
      const item = this.respawnQueue[i];
      item.timer -= deltaTime;

      if (item.timer <= 0) {
        if (item.type === 'rabbit') {
          this.SpawnRabbit();
        } else if (item.type === 'fox') {
          // 25% chance to spawn T-Rex instead of fox
          if (Math.random() < this.trexSpawnChance && this.trexes.length < this.maxTrex) {
            this.SpawnTRex();
          } else {
            this.SpawnFox();
          }
        } else if (item.type === 'trex') {
          this.SpawnTRex();
        } else if (item.type === 'apatosaurus') {
          this.SpawnApatosaurus();
        }
        this.respawnQueue.splice(i, 1);
      }
    }
  }
}
