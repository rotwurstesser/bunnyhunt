import * as THREE from 'three';
import { Component } from '../../core/Component';
import { Entity } from '../../core/Entity';
import RabbitController from '../Animals/RabbitController';
import FoxController from '../Animals/FoxController';
import TRexController from '../Animals/TRexController';
import ApatosaurusController from '../Animals/ApatosaurusController';
import WeaponPickup from '../Pickups/WeaponPickup';
import AmmoPickup from '../Pickups/AmmoPickup';
import { SkeletonUtils } from 'three/examples/jsm/utils/SkeletonUtils';
import { Ammo } from '../../core/AmmoLib';
import type { EntityManager } from '../../core/EntityManager';

// Grass texture
import grassTexture from '../../assets/grass.png';

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
  trexCount: number;
  apatosaurusCount: number;
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
  trex?: THREE.Group & { animations?: THREE.AnimationClip[] };
  apatosaurus?: THREE.Group & { animations?: THREE.AnimationClip[] };
  pistol?: THREE.Object3D;
  smg?: THREE.Object3D;
  assaultRifle?: THREE.Object3D;
  smg2?: THREE.Object3D;
  // Environment models
  tree1?: THREE.Object3D;
  tree2?: THREE.Object3D;
  grassBush?: THREE.Object3D;
  rock?: THREE.Object3D;
  [key: string]: any;
}

export default class TileManager extends Component {
  public readonly name = 'TileManager';

  private scene: THREE.Scene;
  private physicsWorld: Ammo.btDiscreteDynamicsWorld;
  private assets: Assets;
  private entityManager: EntityManager;

  // Grass material (shared across tiles)
  private grassMaterial: THREE.MeshStandardMaterial | null = null;

  // Tile settings
  // Tile settings
  private tileSize = 40;

  // Tile tracking
  private tiles: TileData[] = [];


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

    // Load grass texture and create shared material
    const textureLoader = new THREE.TextureLoader();
    const texture = textureLoader.load(grassTexture);
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    texture.repeat.set(8, 8); // Tile 8x8 times per ground tile
    // Use encoding for older Three.js versions (v0.127.0)
    (texture as any).encoding = (THREE as any).sRGBEncoding;

    this.grassMaterial = new THREE.MeshStandardMaterial({
      map: texture,
      roughness: 0.9,
      metalness: 0.0,
    });

    // Create initial tile at origin
    this.CreateTile(0, 0);

    // Prepare one tile in memory
    this.PrepareTile(1, 0);
  }

  PrepareTile(tileX: number, tileZ: number): void {
    // Pre-generate tile data without adding to scene yet
    const treeCount = 5 + Math.floor(Math.random() * 4);
    const rabbitCount = 1 + Math.floor(Math.random() * 2); // 1-2 rabbits
    const foxCount = Math.random() < 0.2 ? 1 : 0; // 20% chance for fox (reduced by 60%)

    // Check caps for dinos
    const currentTrexCount = this.GetEntityCount('TRexController');
    const trexCount = (Math.random() < 0.05 && currentTrexCount < 2) ? 1 : 0;

    const currentApatoCount = this.GetEntityCount('ApatosaurusController');
    const apatosaurusCount = (Math.random() < 0.1 && currentApatoCount < 4) ? 1 : 0;

    this.preparedTile = {
      x: tileX,
      z: tileZ,
      treeCount,
      rabbitCount,
      foxCount,
      trexCount,
      apatosaurusCount
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

    // Create ground plane for this tile (visual) with vertex displacement
    // Make tiles slightly larger to overlap and hide seams
    const overlap = 0.5;
    const visualSize = this.tileSize + overlap * 2;
    const segments = 16; // More segments for displacement
    const groundGeo = new THREE.PlaneGeometry(visualSize, visualSize, segments, segments);

    // Add subtle vertex displacement for natural bumpy terrain
    const positions = groundGeo.attributes.position.array as Float32Array;
    for (let i = 0; i < positions.length; i += 3) {
      // Add small random height variation (Y is Z after rotation)
      positions[i + 2] += (Math.random() - 0.5) * 0.3;
    }
    groundGeo.computeVertexNormals();

    const ground = new THREE.Mesh(groundGeo, this.grassMaterial);
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

    // Add grass bushes (sparse - 3-6 per tile, here and there)
    const bushCount = 3 + Math.floor(Math.random() * 4);
    for (let i = 0; i < bushCount; i++) {
      const bush = this.CreateGrassBush(centerX, centerZ);
      if (bush) {
        tile.objects.push(bush);
      }
    }

    // Add rocks (1-3 per tile)
    const rockCount = 1 + Math.floor(Math.random() * 3);
    for (let i = 0; i < rockCount; i++) {
      const rock = this.CreateRock(centerX, centerZ);
      if (rock) {
        tile.objects.push(rock);
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

    // Add fox (20% chance)
    const foxCount = this.preparedTile?.foxCount ?? 0;
    for (let i = 0; i < foxCount; i++) {
      const entity = this.SpawnFox(centerX, centerZ);
      if (entity) {
        tile.entities.push(entity);
      }
    }

    // Add T-Rex (5% chance per tile, max 1)
    // Add T-Rex (5% chance, max 2 global)
    const currentTrexCount = this.GetEntityCount('TRexController');
    const trexSpawn = this.preparedTile?.trexCount ?? (Math.random() < 0.05 && currentTrexCount < 2 ? 1 : 0);
    for (let i = 0; i < trexSpawn; i++) {
      const entity = this.SpawnTRex(centerX, centerZ);
      if (entity) {
        tile.entities.push(entity);
      }
    }

    // Add Apatosaurus (10% chance per tile)
    // Add Apatosaurus (10% chance, max 4 global)
    const currentApatoCount = this.GetEntityCount('ApatosaurusController');
    const apatoSpawn = this.preparedTile?.apatosaurusCount ?? (Math.random() < 0.1 && currentApatoCount < 4 ? 1 : 0);
    for (let i = 0; i < apatoSpawn; i++) {
      const entity = this.SpawnApatosaurus(centerX, centerZ);
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


    // NOTE: Pruning is now handled by CheckForNewTiles -> PruneTiles
    // We don't limit by simple count anymore, but by "desired set"


    // Prepare next tile
    this.preparedTile = null;

    return tile;
  }

  CreateTree(centerX: number, centerZ: number): { cleanup: () => void } | null {
    // Random position within tile (with margin)
    const margin = 5;
    const halfSize = this.tileSize / 2 - margin;
    const x = centerX + (Math.random() - 0.5) * 2 * halfSize;
    const z = centerZ + (Math.random() - 0.5) * 2 * halfSize;

    const isPine = Math.random() < 0.5;
    const treeModel = isPine ? this.assets.tree2 : this.assets.tree1; // Assuming tree2 is pine-like

    if (!treeModel) {
      // Fallback to simple cone tree if models not loaded
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

      // Physics collider
      const treeShape = new Ammo.btCylinderShape(new Ammo.btVector3(0.4, 1, 0.4));
      const treeTransform = new Ammo.btTransform();
      treeTransform.setIdentity();
      treeTransform.setOrigin(new Ammo.btVector3(x, 1, z));
      const treeMotionState = new Ammo.btDefaultMotionState(treeTransform);
      const treeInfo = new Ammo.btRigidBodyConstructionInfo(0, treeMotionState, treeShape, new Ammo.btVector3(0, 0, 0));
      const treeBody = new Ammo.btRigidBody(treeInfo);
      (treeBody as any).isTree = true;
      this.physicsWorld.addRigidBody(treeBody);

      return {
        cleanup: () => {
          this.scene.remove(trunk);
          this.scene.remove(leaves);
          try { this.physicsWorld.removeRigidBody(treeBody); } catch (e) { /* ignore */ }
        },
      };
    }

    // Clone the tree model
    const treeClone = treeModel.clone();

    // Specific scaling based on tree type
    let scale = 1.0;
    if (isPine) {
      // Pine trees: [3.0, 5.0]
      scale = 3.0 + Math.random() * 2.0;
    } else {
      // Other trees: [1.2, 1.8]
      scale = 1.2 + Math.random() * 0.6;
    }

    treeClone.scale.set(scale, scale, scale);

    // Random rotation
    treeClone.rotation.y = Math.random() * Math.PI * 2;

    treeClone.position.set(x, 0, z);
    treeClone.traverse((child) => {
      child.castShadow = true;
      child.receiveShadow = true;
    });
    this.scene.add(treeClone);

    // Physics collider (cylinder for trunk)
    const colliderRadius = 0.5 * scale;
    const colliderHeight = 2.0 * scale; // Increased height for bigger trees
    const treeShape = new Ammo.btCylinderShape(new Ammo.btVector3(colliderRadius, colliderHeight / 2, colliderRadius));
    const treeTransform = new Ammo.btTransform();
    treeTransform.setIdentity();
    treeTransform.setOrigin(new Ammo.btVector3(x, colliderHeight / 2, z));
    const treeMotionState = new Ammo.btDefaultMotionState(treeTransform);
    const treeInfo = new Ammo.btRigidBodyConstructionInfo(0, treeMotionState, treeShape, new Ammo.btVector3(0, 0, 0));
    const treeBody = new Ammo.btRigidBody(treeInfo);
    (treeBody as any).isTree = true;
    this.physicsWorld.addRigidBody(treeBody);

    return {
      cleanup: () => {
        this.scene.remove(treeClone);
        try { this.physicsWorld.removeRigidBody(treeBody); } catch (e) { /* ignore */ }
      },
    };
  }

  CreateGrassBush(centerX: number, centerZ: number): { cleanup: () => void } | null {
    const bushModel = this.assets.grassBush;
    if (!bushModel) return null;

    const margin = 3;
    const halfSize = this.tileSize / 2 - margin;
    const x = centerX + (Math.random() - 0.5) * 2 * halfSize;
    const z = centerZ + (Math.random() - 0.5) * 2 * halfSize;

    const bushClone = bushModel.clone();

    // Small random scale (0.3 to 0.6)
    const scale = 0.3 + Math.random() * 0.3;
    bushClone.scale.set(scale, scale, scale);

    // Random rotation
    bushClone.rotation.y = Math.random() * Math.PI * 2;

    bushClone.position.set(x, 0, z);
    bushClone.traverse((child) => {
      child.castShadow = true;
      child.receiveShadow = true;
    });
    this.scene.add(bushClone);

    return {
      cleanup: () => {
        this.scene.remove(bushClone);
      },
    };
  }

  CreateRock(centerX: number, centerZ: number): { cleanup: () => void } | null {
    const rockModel = this.assets.rock;
    if (!rockModel) return null;

    const margin = 4;
    const halfSize = this.tileSize / 2 - margin;
    const x = centerX + (Math.random() - 0.5) * 2 * halfSize;
    const z = centerZ + (Math.random() - 0.5) * 2 * halfSize;

    const rockClone = rockModel.clone();

    // Random scale (0.5 to 1.5)
    const scale = 0.5 + Math.random() * 1.0;
    rockClone.scale.set(scale, scale, scale);

    // Random rotation
    rockClone.rotation.y = Math.random() * Math.PI * 2;

    rockClone.position.set(x, 0, z);
    rockClone.traverse((child) => {
      child.castShadow = true;
      child.receiveShadow = true;
    });
    this.scene.add(rockClone);

    // Physics collider (box for rock)
    const colliderSize = 0.5 * scale;
    const rockShape = new Ammo.btBoxShape(new Ammo.btVector3(colliderSize, colliderSize * 0.5, colliderSize));
    const rockTransform = new Ammo.btTransform();
    rockTransform.setIdentity();
    rockTransform.setOrigin(new Ammo.btVector3(x, colliderSize * 0.5, z));
    const rockMotionState = new Ammo.btDefaultMotionState(rockTransform);
    const rockInfo = new Ammo.btRigidBodyConstructionInfo(0, rockMotionState, rockShape, new Ammo.btVector3(0, 0, 0));
    const rockBody = new Ammo.btRigidBody(rockInfo);
    (rockBody as any).isRock = true;
    this.physicsWorld.addRigidBody(rockBody);

    return {
      cleanup: () => {
        this.scene.remove(rockClone);
        try { this.physicsWorld.removeRigidBody(rockBody); } catch (e) { /* ignore */ }
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
    entity.SetPosition(new THREE.Vector3(x, 0, z));
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
    entity.SetPosition(new THREE.Vector3(x, 0, z));
    entity.AddComponent(new FoxController(modelClone, this.scene, this.physicsWorld));

    this.entityManager.Add(entity);

    // Initialize the entity
    for (const key in entity.components) {
      entity.components[key].Initialize();
    }

    return entity;
  }

  SpawnTRex(centerX: number, centerZ: number): Entity | null {
    const trexModel = this.assets['trex'];
    if (!trexModel) return null;

    const margin = 8; // More margin for larger dino
    const halfSize = this.tileSize / 2 - margin;
    const x = centerX + (Math.random() - 0.5) * 2 * halfSize;
    const z = centerZ + (Math.random() - 0.5) * 2 * halfSize;

    const modelClone = SkeletonUtils.clone(trexModel);

    if (trexModel.animations && trexModel.animations.length > 0) {
      (modelClone as any).animations = trexModel.animations;
    }

    const entity = new Entity();
    entity.SetName(`TRex_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`);
    entity.SetPosition(new THREE.Vector3(x, 0, z));
    entity.AddComponent(new TRexController(modelClone, this.scene, this.physicsWorld));

    this.entityManager.Add(entity);

    for (const key in entity.components) {
      entity.components[key].Initialize();
    }

    return entity;
  }

  SpawnApatosaurus(centerX: number, centerZ: number): Entity | null {
    const apatosaurusModel = this.assets['apatosaurus'];
    if (!apatosaurusModel) return null;

    const margin = 10; // Even more margin for long-neck dino
    const halfSize = this.tileSize / 2 - margin;
    const x = centerX + (Math.random() - 0.5) * 2 * halfSize;
    const z = centerZ + (Math.random() - 0.5) * 2 * halfSize;

    const modelClone = SkeletonUtils.clone(apatosaurusModel);

    if (apatosaurusModel.animations && apatosaurusModel.animations.length > 0) {
      (modelClone as any).animations = apatosaurusModel.animations;
    }

    const entity = new Entity();
    entity.SetName(`Apatosaurus_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`);
    entity.SetPosition(new THREE.Vector3(x, 0, z));
    entity.AddComponent(new ApatosaurusController(modelClone, this.scene, this.physicsWorld));

    this.entityManager.Add(entity);

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

  RemoveTile(tile: TileData, activeTiles: TileData[]): void {
    // Remove all 3D objects
    for (const obj of tile.objects) {
      if ('cleanup' in obj && typeof (obj as any).cleanup === 'function') {
        (obj as any).cleanup();
      } else if (obj instanceof THREE.Mesh) {
        this.scene.remove(obj);
      }
    }

    // Remove physics bodies
    if (tile.physicsBodies) {
      for (const body of tile.physicsBodies) {
        try {
          this.physicsWorld.removeRigidBody(body);
        } catch (e) {
          // Ignore cleanup errors
        }
      }
    }

    // Handle ENTITIES (Relocation Logic)
    // We want to relocate ALL living entities to a valid tile (one of the active ones)
    // instead of destroying them.
    for (const entity of tile.entities) {
      // Pickups can be destroyed (or relocated if preferred, but usually they are plentiful)
      // The user requested "any enemy" and "rabbits, foxes, dinos" be moved.
      // Let's identify "living" things or important things.
      const isLiving =
        entity.GetComponent('RabbitController') ||
        entity.GetComponent('FoxController') ||
        entity.GetComponent('TRexController') ||
        entity.GetComponent('ApatosaurusController') ||
        entity.GetComponent('NpcCharacterController'); // Just in case

      if (isLiving) {
        // Relocate!
        if (activeTiles.length > 0) {
          // Pick a random target tile from the active set
          // Ideally one far away? For now random is safe enough to avoid piling up on one tile.
          const targetTile = activeTiles[Math.floor(Math.random() * activeTiles.length)];
          this.RelocateEntity(entity, targetTile);
        } else {
          // No active tiles? Should not happen if game is running.
          // Just cleanup.
          this.CleanupEntity(entity);
        }
      } else {
        // Pickups, etc. - Destroy them
        this.CleanupEntity(entity);
      }

      this.entityManager.Remove(entity);
    }
  }

  CleanupEntity(entity: Entity): void {
    // General cleanup helper
    const components = [
      'RabbitController', 'FoxController', 'TRexController', 'ApatosaurusController',
      'WeaponPickup', 'AmmoPickup'
    ];

    for (const c of components) {
      const comp = entity.GetComponent(c as any);
      if (comp && 'Cleanup' in comp) {
        (comp as any).Cleanup();
      }
    }
  }

  GetEntityCount(componentName: string): number {
    let count = 0;
    for (const tile of this.tiles) {
      for (const entity of tile.entities) {
        if (entity.GetComponent(componentName)) {
          count++;
        }
      }
    }
    return count;
  }

  RelocateEntity(entity: Entity, targetTile: TileData): void {
    const margin = 10;
    const halfSize = this.tileSize / 2 - margin;
    const centerX = targetTile.x * this.tileSize;
    const centerZ = targetTile.z * this.tileSize;

    const x = centerX + (Math.random() - 0.5) * 2 * halfSize;
    const z = centerZ + (Math.random() - 0.5) * 2 * halfSize;

    const animalController =
      entity.GetComponent('RabbitController') ||
      entity.GetComponent('FoxController') ||
      entity.GetComponent('TRexController') ||
      entity.GetComponent('ApatosaurusController');

    if (animalController) {
      // Move visual model
      (animalController as any).model.position.set(x, 0.5, z);
      // Let update loop handle collider sync, or force it here if needed
      if ('updateColliderPosition' in animalController) {
        (animalController as any).updateColliderPosition();
      }
      // Reset path/state
      if ('clearPath' in animalController) {
        (animalController as any).clearPath();
      }
    }

    // Add to new tile
    targetTile.entities.push(entity);
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

    // NEW LOGIC: Field of View / Directional Generation
    this.UpdateTiles();
  }

  UpdateTiles(): void {
    const desiredCoords = this.GetDesiredTiles();

    // 1. Create missing tiles
    for (const coord of desiredCoords) {
      this.EnsureTileExists(coord.x, coord.z);
    }

    // 2. Prune tiles that are not in desired set
    this.PruneTiles(desiredCoords);
  }

  GetDesiredTiles(): { x: number, z: number }[] {
    if (!this.player) return [];

    const playerTile = this.GetPlayerTile();
    const desired = [];

    // Determine player direction
    // Retrieve rotation from player entity
    const rotation = this.player.Rotation;
    const forward = new THREE.Vector3(0, 0, -1);
    forward.applyQuaternion(rotation);

    // Determine cardinal direction
    // North: -Z, South: +Z, East: +X, West: -X
    const absX = Math.abs(forward.x);
    const absZ = Math.abs(forward.z);

    // Config
    const forwardDepth = 4; // FOV
    const backDepth = 2;
    const sideWidth = 2; // tiles to left/right center

    // Ranges
    let minX = 0, maxX = 0, minZ = 0, maxZ = 0;

    if (absZ > absX) {
      // Facing North or South
      const isNorth = forward.z < 0;

      // Side range is X
      minX = playerTile.x - sideWidth;
      maxX = playerTile.x + sideWidth;

      if (isNorth) {
        // Facing -Z
        minZ = playerTile.z - forwardDepth;
        maxZ = playerTile.z + backDepth;
      } else {
        // Facing +Z
        minZ = playerTile.z - backDepth;
        maxZ = playerTile.z + forwardDepth;
      }
    } else {
      // Facing East or West
      const isEast = forward.x > 0;

      // Side range is Z
      minZ = playerTile.z - sideWidth;
      maxZ = playerTile.z + sideWidth;

      if (isEast) {
        // Facing +X
        minX = playerTile.x - backDepth;
        maxX = playerTile.x + forwardDepth;
      } else {
        // Facing -X
        minX = playerTile.x - forwardDepth;
        maxX = playerTile.x + backDepth;
      }
    }

    // Generate coords
    for (let x = minX; x <= maxX; x++) {
      for (let z = minZ; z <= maxZ; z++) {
        desired.push({ x, z });
      }
    }

    return desired;
  }

  PruneTiles(desiredCoords: { x: number, z: number }[]): void {
    // Identify tiles to remove
    const tilesToRemove: TileData[] = [];
    const tilesToKeep: TileData[] = [];

    const desiredSet = new Set(desiredCoords.map(c => `${c.x},${c.z}`));

    for (const tile of this.tiles) {
      const key = `${tile.x},${tile.z}`;
      if (!desiredSet.has(key)) {
        tilesToRemove.push(tile);
      } else {
        tilesToKeep.push(tile);
      }
    }

    if (tilesToRemove.length === 0) return;

    // Update this.tiles immediately to reflect kept tiles (so relocation CAN find them)
    this.tiles = tilesToKeep;

    // Now remove the old ones and relocate entities to the KEEP set
    for (const tile of tilesToRemove) {
      this.RemoveTile(tile, tilesToKeep);
    }

    console.log(`Pruned ${tilesToRemove.length} tiles. Active: ${this.tiles.length}`);

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
