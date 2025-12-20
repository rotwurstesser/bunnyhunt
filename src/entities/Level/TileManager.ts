import * as THREE from 'three';
import { Component } from '../../core/Component';
import { Entity } from '../../core/Entity';
import RabbitController from '../Animals/RabbitController';
import FoxController from '../Animals/FoxController';
import WeaponPickup from '../Pickups/WeaponPickup';
import AmmoPickup from '../Pickups/AmmoPickup';
import { SkeletonUtils } from 'three/examples/jsm/utils/SkeletonUtils';
import { Ammo } from '../../core/AmmoLib';
import type { EntityManager } from '../../core/EntityManager';

interface TileData {
  x: number;
  z: number;
  objects: Array<{ trunk?: THREE.Mesh; leaves?: THREE.Mesh; cleanup?: () => void } | THREE.Mesh>;
  entities: Entity[];
  physicsBodies: Ammo.btRigidBody[];
}

interface PreparedTileData {
  x: number;
  z: number;
  treeCount: number;
  rabbitCount: number;
  foxCount: number;
}

interface TreeObject {
  trunk: THREE.Mesh;
  leaves: THREE.Mesh;
  physicsBody: Ammo.btRigidBody;
  cleanup: () => void;
}

interface Assets {
  rabbit?: { scene?: THREE.Object3D; animations?: THREE.AnimationClip[] };
  fox?: { scene?: THREE.Object3D; animations?: THREE.AnimationClip[] };
  pistol?: THREE.Object3D;
  smg?: THREE.Object3D;
  assaultRifle?: THREE.Object3D;
  smg2?: THREE.Object3D;
  [key: string]: any;
}

export default class TileManager extends Component {
  public readonly name = 'TileManager';

  private scene: THREE.Scene;
  private physicsWorld: Ammo.btDiscreteDynamicsWorld;
  private assets: Assets;
  private entityManager: EntityManager;

  // Tile settings
  private tileSize = 40;
  private triggerDistance = 18;
  private maxTiles = 15;

  // Tile tracking
  private tiles: TileData[] = [];
  private currentTileX = 0;
  private currentTileZ = 0;

  // Pre-generated tile ready to add
  private preparedTile: PreparedTileData | null = null;

  // Player reference
  private player: Entity | null = null;

  constructor(
    scene: THREE.Scene,
    physicsWorld: Ammo.btDiscreteDynamicsWorld,
    assets: Assets,
    entityManager: EntityManager
  ) {
    super();
    this.scene = scene;
    this.physicsWorld = physicsWorld;
    this.assets = assets;
    this.entityManager = entityManager;
  }

  Initialize(): void {
    this.player = this.FindEntity('Player');

    // Create initial tile at origin
    this.CreateTile(0, 0);

    // Prepare one tile in memory
    this.PrepareTile(1, 0);
  }

  PrepareTile(tileX: number, tileZ: number): void {
    // Pre-generate tile data without adding to scene yet
    const treeCount = 5 + Math.floor(Math.random() * 4); // 5-8 trees
    const rabbitCount = 3;
    const foxCount = 1;

    this.preparedTile = {
      x: tileX,
      z: tileZ,
      treeCount,
      rabbitCount,
      foxCount,
    };
  }

  CreateTile(tileX: number, tileZ: number): TileData {
    const tile: TileData = {
      x: tileX,
      z: tileZ,
      objects: [],
      entities: [],
      physicsBodies: [],
    };

    const centerX = tileX * this.tileSize;
    const centerZ = tileZ * this.tileSize;

    // Create ground plane for this tile (visual)
    const groundGeo = new THREE.PlaneGeometry(this.tileSize, this.tileSize);
    const groundMat = new THREE.MeshLambertMaterial({ color: 0x7cba5c });
    const ground = new THREE.Mesh(groundGeo, groundMat);
    ground.rotation.x = -Math.PI / 2;
    ground.position.set(centerX, 0, centerZ);
    ground.receiveShadow = true;
    this.scene.add(ground);
    tile.objects.push(ground);

    // Create ground physics (collision)
    const groundShape = new Ammo.btBoxShape(
      new Ammo.btVector3(this.tileSize / 2, 0.5, this.tileSize / 2)
    );
    const groundTransform = new Ammo.btTransform();
    groundTransform.setIdentity();
    groundTransform.setOrigin(new Ammo.btVector3(centerX, -0.5, centerZ));
    const groundMotionState = new Ammo.btDefaultMotionState(groundTransform);
    const groundInfo = new Ammo.btRigidBodyConstructionInfo(
      0,
      groundMotionState,
      groundShape,
      new Ammo.btVector3(0, 0, 0)
    );
    const groundBody = new Ammo.btRigidBody(groundInfo);
    this.physicsWorld.addRigidBody(groundBody);
    tile.physicsBodies.push(groundBody);

    // Add trees (5-8)
    const treeCount = this.preparedTile?.treeCount || 5 + Math.floor(Math.random() * 4);
    for (let i = 0; i < treeCount; i++) {
      const tree = this.CreateTree(centerX, centerZ);
      if (tree) {
        tile.objects.push(tree);
      }
    }

    // Add rabbits (3)
    const rabbitCount = this.preparedTile?.rabbitCount || 3;
    for (let i = 0; i < rabbitCount; i++) {
      const entity = this.SpawnRabbit(centerX, centerZ);
      if (entity) {
        tile.entities.push(entity);
      }
    }

    // Add fox (1)
    const foxCount = this.preparedTile?.foxCount || 1;
    for (let i = 0; i < foxCount; i++) {
      const entity = this.SpawnFox(centerX, centerZ);
      if (entity) {
        tile.entities.push(entity);
      }
    }

    // Add ammo pickup (1 per tile)
    const ammoPickup = this.SpawnAmmoPickup(centerX, centerZ);
    if (ammoPickup) {
      tile.entities.push(ammoPickup);
    }

    // Random weapon pickup with rarity
    // AK-47: 25%, Gatling: 12%, Nuke: 3%
    const weaponRoll = Math.random();
    if (weaponRoll < 0.03) {
      // Nuke (3% chance)
      const pickup = this.SpawnWeaponPickup(centerX, centerZ, 'nuke');
      if (pickup) tile.entities.push(pickup);
    } else if (weaponRoll < 0.15) {
      // Gatling (12% chance)
      const pickup = this.SpawnWeaponPickup(centerX, centerZ, 'gatling');
      if (pickup) tile.entities.push(pickup);
    } else if (weaponRoll < 0.4) {
      // AK-47 (25% chance)
      const pickup = this.SpawnWeaponPickup(centerX, centerZ, 'ak47');
      if (pickup) tile.entities.push(pickup);
    }

    this.tiles.push(tile);

    // Check if we need to remove old tiles
    if (this.tiles.length > this.maxTiles) {
      this.RemoveOldestTile();
    }

    // Prepare next tile
    this.preparedTile = null;

    return tile;
  }

  CreateTree(centerX: number, centerZ: number): TreeObject | null {
    // Random position within tile (with margin)
    const margin = 5;
    const halfSize = this.tileSize / 2 - margin;
    const x = centerX + (Math.random() - 0.5) * 2 * halfSize;
    const z = centerZ + (Math.random() - 0.5) * 2 * halfSize;

    // Simple cone tree
    const trunkGeo = new THREE.CylinderGeometry(0.3, 0.4, 2, 8);
    const trunkMat = new THREE.MeshLambertMaterial({ color: 0x8b4513 });
    const trunk = new THREE.Mesh(trunkGeo, trunkMat);
    trunk.position.set(x, 1, z);
    trunk.castShadow = true;
    this.scene.add(trunk);

    const leavesGeo = new THREE.ConeGeometry(2, 5, 8);
    const leavesMat = new THREE.MeshLambertMaterial({ color: 0x228b22 });
    const leaves = new THREE.Mesh(leavesGeo, leavesMat);
    leaves.position.set(x, 4.5, z);
    leaves.castShadow = true;
    this.scene.add(leaves);

    // Add physics collider for trunk (cylinder)
    const treeShape = new Ammo.btCylinderShape(new Ammo.btVector3(0.4, 1, 0.4));
    const treeTransform = new Ammo.btTransform();
    treeTransform.setIdentity();
    treeTransform.setOrigin(new Ammo.btVector3(x, 1, z));
    const treeMotionState = new Ammo.btDefaultMotionState(treeTransform);
    const treeInfo = new Ammo.btRigidBodyConstructionInfo(
      0,
      treeMotionState,
      treeShape,
      new Ammo.btVector3(0, 0, 0)
    );
    const treeBody = new Ammo.btRigidBody(treeInfo);
    (treeBody as any).isTree = true; // Mark as tree for impact effects
    this.physicsWorld.addRigidBody(treeBody);

    // Return group-like object for cleanup
    return {
      trunk,
      leaves,
      physicsBody: treeBody,
      cleanup: () => {
        this.scene.remove(trunk);
        this.scene.remove(leaves);
        try {
          this.physicsWorld.removeRigidBody(treeBody);
        } catch (e) {
          // Ignore cleanup errors
        }
      },
    };
  }

  SpawnRabbit(centerX: number, centerZ: number): Entity | null {
    const rabbitModel = this.assets['rabbit'];
    if (!rabbitModel) return null;

    const margin = 5;
    const halfSize = this.tileSize / 2 - margin;
    const x = centerX + (Math.random() - 0.5) * 2 * halfSize;
    const z = centerZ + (Math.random() - 0.5) * 2 * halfSize;

    const sourceScene = rabbitModel.scene || rabbitModel;
    const modelClone = SkeletonUtils.clone(sourceScene);

    if (rabbitModel.animations && rabbitModel.animations.length > 0) {
      (modelClone as any).animations = rabbitModel.animations;
    }

    const entity = new Entity();
    entity.SetName(`Rabbit_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`);
    entity.SetPosition(new THREE.Vector3(x, 0.5, z));
    entity.AddComponent(new RabbitController(modelClone, this.scene, this.physicsWorld));

    this.entityManager.Add(entity);

    // Initialize the entity
    for (const key in entity.components) {
      entity.components[key].Initialize();
    }

    return entity;
  }

  SpawnFox(centerX: number, centerZ: number): Entity | null {
    const foxModel = this.assets['fox'];
    if (!foxModel) return null;

    const margin = 5;
    const halfSize = this.tileSize / 2 - margin;
    const x = centerX + (Math.random() - 0.5) * 2 * halfSize;
    const z = centerZ + (Math.random() - 0.5) * 2 * halfSize;

    const sourceScene = foxModel.scene || foxModel;
    const modelClone = SkeletonUtils.clone(sourceScene);

    if (foxModel.animations && foxModel.animations.length > 0) {
      (modelClone as any).animations = foxModel.animations;
    }

    const entity = new Entity();
    entity.SetName(`Fox_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`);
    entity.SetPosition(new THREE.Vector3(x, 0.5, z));
    entity.AddComponent(new FoxController(modelClone, this.scene, this.physicsWorld));

    this.entityManager.Add(entity);

    // Initialize the entity
    for (const key in entity.components) {
      entity.components[key].Initialize();
    }

    return entity;
  }

  SpawnWeaponPickup(centerX: number, centerZ: number, weaponKey: string): Entity | null {
    const margin = 5;
    const halfSize = this.tileSize / 2 - margin;
    const x = centerX + (Math.random() - 0.5) * 2 * halfSize;
    const z = centerZ + (Math.random() - 0.5) * 2 * halfSize;

    const position = new THREE.Vector3(x, 0, z);

    // Get weapon assets for pickup display
    const weaponAssets = {
      pistol: this.assets['pistol'],
      smg: this.assets['smg'],
      assaultRifle: this.assets['assaultRifle'],
      smg2: this.assets['smg2'],
    };

    const entity = new Entity();
    entity.SetName(`WeaponPickup_${weaponKey}_${Date.now()}`);
    entity.SetPosition(position);
    entity.AddComponent(new WeaponPickup(this.scene, weaponKey, position, weaponAssets));

    this.entityManager.Add(entity);

    for (const key in entity.components) {
      entity.components[key].Initialize();
    }

    return entity;
  }

  SpawnAmmoPickup(centerX: number, centerZ: number): Entity | null {
    const margin = 5;
    const halfSize = this.tileSize / 2 - margin;
    const x = centerX + (Math.random() - 0.5) * 2 * halfSize;
    const z = centerZ + (Math.random() - 0.5) * 2 * halfSize;

    // Create simple ammo box visual
    const entity = new Entity();
    entity.SetName(`AmmoPickup_${Date.now()}`);
    entity.SetPosition(new THREE.Vector3(x, 0, z));

    // Create ammo pickup component
    entity.AddComponent(new AmmoPickup(this.scene, new THREE.Vector3(x, 0, z)));

    this.entityManager.Add(entity);

    for (const key in entity.components) {
      entity.components[key].Initialize();
    }

    return entity;
  }

  RemoveOldestTile(): void {
    if (this.tiles.length === 0) return;

    const oldTile = this.tiles.shift()!;

    // Remove all 3D objects
    for (const obj of oldTile.objects) {
      if ('cleanup' in obj && typeof obj.cleanup === 'function') {
        obj.cleanup();
      } else if (obj instanceof THREE.Mesh) {
        this.scene.remove(obj);
      }
    }

    // Remove physics bodies
    if (oldTile.physicsBodies) {
      for (const body of oldTile.physicsBodies) {
        try {
          this.physicsWorld.removeRigidBody(body);
        } catch (e) {
          // Ignore cleanup errors
        }
      }
    }

    // Remove all entities (animals, pickups, etc.)
    for (const entity of oldTile.entities) {
      // Handle animal controllers
      const animalController =
        entity.GetComponent('RabbitController') || entity.GetComponent('FoxController');
      if (animalController && 'Cleanup' in animalController) {
        (animalController as any).Cleanup();
      }
      // Handle weapon pickups
      const weaponPickup = entity.GetComponent('WeaponPickup');
      if (weaponPickup && 'Cleanup' in weaponPickup) {
        (weaponPickup as any).Cleanup();
      }
      // Handle ammo pickups
      const ammoPickup = entity.GetComponent('AmmoPickup');
      if (ammoPickup && 'Cleanup' in ammoPickup) {
        (ammoPickup as any).Cleanup();
      }
      this.entityManager.Remove(entity);
    }
  }

  GetPlayerTile(): { x: number; z: number } {
    if (!this.player) return { x: 0, z: 0 };
    const pos = this.player.Position;
    return {
      x: Math.floor(pos.x / this.tileSize + 0.5),
      z: Math.floor(pos.z / this.tileSize + 0.5),
    };
  }

  CheckForNewTiles(): void {
    if (!this.player) return;

    const pos = this.player.Position;
    const playerTile = this.GetPlayerTile();

    // Check distance to each edge of current tile
    const tileCenterX = playerTile.x * this.tileSize;
    const tileCenterZ = playerTile.z * this.tileSize;
    const halfTile = this.tileSize / 2;

    // Distance to edges
    const distToRight = tileCenterX + halfTile - pos.x;
    const distToLeft = pos.x - (tileCenterX - halfTile);
    const distToFront = tileCenterZ + halfTile - pos.z;
    const distToBack = pos.z - (tileCenterZ - halfTile);

    // Check if we need to create tiles in any direction
    if (distToRight < this.triggerDistance) {
      this.EnsureTileExists(playerTile.x + 1, playerTile.z);
    }
    if (distToLeft < this.triggerDistance) {
      this.EnsureTileExists(playerTile.x - 1, playerTile.z);
    }
    if (distToFront < this.triggerDistance) {
      this.EnsureTileExists(playerTile.x, playerTile.z + 1);
    }
    if (distToBack < this.triggerDistance) {
      this.EnsureTileExists(playerTile.x, playerTile.z - 1);
    }
  }

  EnsureTileExists(tileX: number, tileZ: number): void {
    // Check if tile already exists
    const exists = this.tiles.some((t) => t.x === tileX && t.z === tileZ);
    if (!exists) {
      this.PrepareTile(tileX, tileZ);
      this.CreateTile(tileX, tileZ);
    }
  }

  Update(t: number): void {
    this.CheckForNewTiles();
  }
}
