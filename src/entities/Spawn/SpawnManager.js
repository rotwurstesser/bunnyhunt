import * as THREE from 'three'
import { SkeletonUtils } from 'three/examples/jsm/utils/SkeletonUtils'
import Component from '../../Component'
import Entity from '../../Entity'
import RabbitController from '../Animals/RabbitController'
import FoxController from '../Animals/FoxController'
import NukeProjectile from '../Player/NukeProjectile'
import WeaponPickup from '../Pickups/WeaponPickup'

export default class SpawnManager extends Component {
    constructor(scene, physicsWorld, assets) {
        super();
        this.name = 'SpawnManager';
        this.scene = scene;
        this.physicsWorld = physicsWorld;
        this.assets = assets;

        // Spawn configuration
        this.maxRabbits = 12;
        this.maxFoxes = 2;
        this.initialRabbits = 8;
        this.initialFoxes = 1;
        this.respawnCooldown = 5; // seconds

        // Entity tracking
        this.rabbits = [];
        this.foxes = [];
        this.respawnQueue = [];
        this.initialSpawnComplete = false;
    }

    Initialize() {
        const level = this.FindEntity('Level');
        this.navmesh = level?.GetComponent('Navmesh');
        this.entityManager = this.parent.parent; // Access EntityManager

        // Listen for death events
        this.parent.RegisterEventHandler(this.OnAnimalDied, 'animal_died');
        this.parent.RegisterEventHandler(this.OnNukeDetonated, 'nuke_detonated');
        this.parent.RegisterEventHandler(this.OnNukeFired, 'nuke_fired');
        this.parent.RegisterEventHandler(this.OnFoxWeaponDrop, 'fox_weapon_drop');

        // Note: Initial spawning is now handled by TileManager
        // SpawnManager only handles respawns and nuke events
    }

    OnFoxWeaponDrop = (msg) => {
        // Random weapon with rarity - foxes drop better loot!
        // AK-47: 50%, Gatling: 35%, Nuke: 15%
        const roll = Math.random();
        let weaponKey = 'ak47';
        if (roll < 0.15) {
            weaponKey = 'nuke';
        } else if (roll < 0.50) {
            weaponKey = 'gatling';
        }

        this.SpawnWeaponPickup(msg.position, weaponKey);
    }

    SpawnWeaponPickup(position, weaponKey) {
        // Get weapon assets for pickup display
        const weaponAssets = {
            pistol: this.assets['pistol'],
            smg: this.assets['smg'],
            assaultRifle: this.assets['assaultRifle'],
            smg2: this.assets['smg2']
        };

        const entity = new Entity();
        entity.SetName(`WeaponDrop_${weaponKey}_${Date.now()}`);
        entity.SetPosition(position);
        entity.AddComponent(new WeaponPickup(this.scene, weaponKey, position, weaponAssets));

        this.entityManager.Add(entity);

        for (const key in entity.components) {
            entity.components[key].Initialize();
        }

        return entity;
    }

    GetRandomSpawnPosition() {
        // Player spawns at center (0,0), so spawn animals away from center
        const minDistFromCenter = 8;
        const maxDist = 30;

        // Generate random angle and distance
        const angle = Math.random() * Math.PI * 2;
        const distance = minDistFromCenter + Math.random() * (maxDist - minDistFromCenter);

        const x = Math.cos(angle) * distance;
        const z = Math.sin(angle) * distance;

        // Spawn slightly above ground to ensure visibility (Y=0.5)
        const spawnY = 0.5;

        // Try navmesh first
        try {
            const targetPos = new THREE.Vector3(x, spawnY, z);
            const node = this.navmesh?.GetRandomNode(targetPos, 10);
            if (node) {
                node.y = spawnY; // Force spawn height
                return node;
            }
        } catch (e) {
            // Navmesh failed, use fallback
        }

        // Fallback to calculated position
        return new THREE.Vector3(x, spawnY, z);
    }

    SpawnRabbit() {
        if (this.rabbits.length >= this.maxRabbits) return null;

        const position = this.GetRandomSpawnPosition();
        const entity = this.CreateRabbitEntity(position);

        if (entity) {
            this.entityManager.Add(entity);
            // Initialize is called by EntityManager.EndSetup() for initial spawns
            // For runtime spawns (respawns), we need to call Initialize manually
            if (this.initialSpawnComplete) {
                for (const key in entity.components) {
                    entity.components[key].Initialize();
                }
            }
            this.rabbits.push(entity);
        }

        return entity;
    }

    CreateRabbitEntity(position) {
        const rabbitModel = this.assets['rabbit'];
        if (!rabbitModel) {
            console.error('Rabbit model not loaded');
            return null;
        }

        // Clone the model using SkeletonUtils for proper skinned mesh cloning
        const sourceScene = rabbitModel.scene || rabbitModel;
        const modelClone = SkeletonUtils.clone(sourceScene);

        // Copy animations from GLTF root to the cloned model
        if (rabbitModel.animations && rabbitModel.animations.length > 0) {
            modelClone.animations = rabbitModel.animations;
        }

        const entity = new Entity();
        entity.SetName(`Rabbit_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`);
        entity.SetPosition(position);
        entity.AddComponent(new RabbitController(modelClone, this.scene, this.physicsWorld));

        return entity;
    }

    SpawnFox() {
        if (this.foxes.length >= this.maxFoxes) return null;

        const position = this.GetRandomSpawnPosition();
        const entity = this.CreateFoxEntity(position);

        if (entity) {
            this.entityManager.Add(entity);
            // Initialize is called by EntityManager.EndSetup() for initial spawns
            // For runtime spawns (respawns), we need to call Initialize manually
            if (this.initialSpawnComplete) {
                for (const key in entity.components) {
                    entity.components[key].Initialize();
                }
            }
            this.foxes.push(entity);
        }

        return entity;
    }

    CreateFoxEntity(position) {
        const foxModel = this.assets['fox'];
        if (!foxModel) {
            console.error('Fox model not loaded');
            return null;
        }

        // Clone the model using SkeletonUtils for proper skinned mesh cloning
        const sourceScene = foxModel.scene || foxModel;
        const modelClone = SkeletonUtils.clone(sourceScene);

        // Copy animations from GLTF root to the cloned model
        if (foxModel.animations && foxModel.animations.length > 0) {
            modelClone.animations = foxModel.animations;
        }

        const entity = new Entity();
        entity.SetName(`Fox_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`);
        entity.SetPosition(position);
        entity.AddComponent(new FoxController(modelClone, this.scene, this.physicsWorld));

        return entity;
    }

    OnAnimalDied = (msg) => {
        // Remove from active list
        if (msg.type === 'rabbit') {
            this.rabbits = this.rabbits.filter(r => r !== msg.entity);
        } else if (msg.type === 'fox') {
            this.foxes = this.foxes.filter(f => f !== msg.entity);
        }

        // Queue respawn
        this.respawnQueue.push({
            type: msg.type,
            timer: this.respawnCooldown,
            position: msg.position
        });

        // Schedule entity cleanup (wait longer for dramatic effect)
        setTimeout(() => {
            this.CleanupEntity(msg.entity);
        }, 6000); // Wait 6 seconds before cleanup
    }

    CleanupEntity(entity) {
        // Get the controller and cleanup
        const controller = entity.GetComponent('RabbitController') ||
                          entity.GetComponent('FoxController');
        if (controller && controller.Cleanup) {
            controller.Cleanup();
        }

        // Remove from entity manager
        this.entityManager.Remove(entity);
    }

    OnNukeFired = (msg) => {
        // Create nuke projectile entity
        const nukeEntity = new Entity();
        nukeEntity.SetName(`Nuke_${Date.now()}`);
        nukeEntity.SetPosition(msg.startPosition);
        nukeEntity.AddComponent(new NukeProjectile(this.scene, msg.startPosition, msg.direction));
        this.entityManager.Add(nukeEntity);

        // Initialize the projectile
        for (const key in nukeEntity.components) {
            nukeEntity.components[key].Initialize();
        }
    }

    OnNukeDetonated = () => {
        // Kill all animals
        const allAnimals = [...this.rabbits, ...this.foxes];
        allAnimals.forEach(animal => {
            const controller = animal.GetComponent('RabbitController') ||
                              animal.GetComponent('FoxController');
            if (controller && !controller.isDead) {
                controller.TakeHit({ amount: 9999 });
            }
        });
    }

    Update(t) {
        // Process respawn queue
        for (let i = this.respawnQueue.length - 1; i >= 0; i--) {
            const item = this.respawnQueue[i];
            item.timer -= t;

            if (item.timer <= 0) {
                if (item.type === 'rabbit') {
                    this.SpawnRabbit();
                } else if (item.type === 'fox') {
                    this.SpawnFox();
                }
                this.respawnQueue.splice(i, 1);
            }
        }
    }
}
