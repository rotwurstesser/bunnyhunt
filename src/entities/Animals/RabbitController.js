import * as THREE from 'three'
import Component from '../../Component'
import { Ammo, AmmoHelper, CollisionFilterGroups } from '../../AmmoLib'
import RabbitFSM from './RabbitFSM'

export default class RabbitController extends Component {
    constructor(model, scene, physicsWorld) {
        super();
        this.name = 'RabbitController';
        this.animalType = 'rabbit';
        this.physicsWorld = physicsWorld;
        this.scene = scene;
        this.model = model;
        this.path = [];
        this.tempRot = new THREE.Quaternion();
        this.forwardVec = new THREE.Vector3(0, 0, 1);
        this.tempVec = new THREE.Vector3();

        // Rabbit-specific settings
        this.health = 10;
        this.speed = 8.0;
        this.fleeDistance = 15.0;
        this.baseScale = 0.5; // Larger size for better visibility
        this.isDead = false;
        this.mixer = null;
        this.currentAction = null;
        this.initialized = false;
    }

    Initialize() {
        // Prevent double initialization
        if (this.initialized) return;
        this.initialized = true;

        this.stateMachine = new RabbitFSM(this);
        const level = this.FindEntity('Level');
        this.navmesh = level?.GetComponent('Navmesh');
        this.player = this.FindEntity("Player");


        // Register for hit events
        this.parent.RegisterEventHandler(this.TakeHit, 'hit');

        // Setup model - rabbit model has good size at scale 0.5 (~1.5m tall)
        this.model.scale.setScalar(this.baseScale);
        this.model.position.copy(this.parent.position);

        // Setup animations
        this.SetupAnimations();

        // Fix materials and ensure shadows
        this.model.traverse(child => {
            if (child.isMesh) {
                child.castShadow = true;
                child.receiveShadow = true;
                // Force double-sided rendering and fix potential material issues
                if (child.material) {
                    child.material.side = THREE.DoubleSide;
                    child.material.needsUpdate = true;
                }
            }
        });

        this.scene.add(this.model);

        // Create physics trigger for hit detection
        this.CreateCollider();

        // Start idle
        this.stateMachine.SetState('idle');
    }

    SetupAnimations() {
        // Find animations in the model
        let animations = this.model.animations || [];
        if (!animations.length && this.model.parent?.animations) {
            animations = this.model.parent.animations;
        }

        if (animations.length > 0) {
            this.mixer = new THREE.AnimationMixer(this.model);
            this.animations = {};

            // Map animation names to clips
            // Rabbit animations: Die (0), Idle (1), Run (2)
            animations.forEach((clip, index) => {
                const name = clip.name.toLowerCase();
                if (name.includes('idle')) {
                    this.animations.idle = clip;
                } else if (name.includes('run') || name.includes('walk')) {
                    this.animations.run = clip;
                } else if (name.includes('die') || name.includes('death')) {
                    this.animations.die = clip;
                }
            });

            // Start with idle animation
            if (this.animations.idle) {
                this.currentAction = this.mixer.clipAction(this.animations.idle);
                this.currentAction.play();
            }
        }
    }

    PlayAnimation(name, loop = true) {
        if (!this.mixer || !this.animations?.[name]) return;

        const clip = this.animations[name];
        const newAction = this.mixer.clipAction(clip);

        if (!loop) {
            newAction.setLoop(THREE.LoopOnce);
            newAction.clampWhenFinished = true;
        }

        if (this.currentAction) {
            newAction.reset();
            newAction.crossFadeFrom(this.currentAction, 0.2, true);
            newAction.play();
            this.currentAction = newAction;
        } else {
            this.currentAction = newAction;
            this.currentAction.play();
        }
    }

    CreateCollider() {
        // Collider sized for rabbit (~4.3 units tall after scaling)
        const shape = new Ammo.btSphereShape(1.5);
        this.ghostObj = AmmoHelper.CreateTrigger(shape);
        // Register this collision object with its entity for raycast hit detection
        AmmoHelper.RegisterCollisionEntity(this.ghostObj, this.parent);
        this.physicsWorld.addCollisionObject(
            this.ghostObj,
            CollisionFilterGroups.SensorTrigger,
            CollisionFilterGroups.AllFilter
        );
        this.UpdateColliderPosition();
    }

    UpdateColliderPosition() {
        if (this.ghostObj) {
            const transform = this.ghostObj.getWorldTransform();
            const pos = this.model.position;
            transform.getOrigin().setValue(pos.x, pos.y + 0.3, pos.z);
        }
    }

    IsPlayerNear() {
        if (!this.player) return false;
        const dist = this.model.position.distanceTo(this.player.Position);
        return dist < this.fleeDistance;
    }

    NavigateToRandomPoint() {
        if (!this.navmesh) return;
        const node = this.navmesh.GetRandomNode(this.model.position, 20);
        if (node) {
            this.path = this.navmesh.FindPath(this.model.position, node) || [];
        }
    }

    NavigateAwayFromPlayer() {
        if (!this.player || !this.navmesh) return;

        // Calculate direction away from player
        const fleeDir = new THREE.Vector3();
        fleeDir.subVectors(this.model.position, this.player.Position);
        fleeDir.y = 0;
        if (fleeDir.lengthSq() < 0.001) {
            fleeDir.set(Math.random() - 0.5, 0, Math.random() - 0.5);
        }
        fleeDir.normalize();

        // Find a point in the flee direction
        const fleeTarget = this.model.position.clone();
        fleeTarget.add(fleeDir.multiplyScalar(20));

        // Get nearest valid navmesh point
        const node = this.navmesh.GetRandomNode(fleeTarget, 10);
        if (node) {
            this.path = this.navmesh.FindPath(this.model.position, node) || [];
        }
    }

    ClearPath() {
        this.path = [];
    }

    MoveAlongPath(t) {
        if (!this.path?.length || this.isDead) return;

        const target = this.path[0].clone().sub(this.model.position);
        target.y = 0;

        if (target.lengthSq() > 0.3 * 0.3) {
            // Move towards target
            target.normalize();

            // Rotate to face movement direction
            this.tempRot.setFromUnitVectors(this.forwardVec, target);
            this.model.quaternion.slerp(this.tempRot, 6.0 * t);

            // Move forward
            const moveAmount = this.speed * t;
            this.model.position.add(target.multiplyScalar(moveAmount));
        } else {
            // Reached waypoint, remove it
            this.path.shift();
        }
    }

    TakeHit = (msg) => {
        if (this.isDead) return;

        this.health = Math.max(0, this.health - msg.amount);

        if (this.health <= 0) {
            this.isDead = true;

            // IMPORTANT: Send notifications BEFORE setting state (which may crash)
            // Notify GameManager about the kill
            const gameManager = this.FindEntity("GameManager");
            if (gameManager) {
                gameManager.Broadcast({
                    topic: 'animal_killed',
                    entity: this.parent,
                    type: 'rabbit'
                });
            }

            // Notify SpawnManager for respawn
            const spawnManager = this.FindEntity("SpawnManager");
            if (spawnManager) {
                spawnManager.Broadcast({
                    topic: 'animal_died',
                    entity: this.parent,
                    type: 'rabbit',
                    position: this.model.position.clone()
                });
            }

            // Now set state (which triggers OnDeath)
            this.stateMachine.SetState('dead');
        } else {
            // Got hit but not dead - flee!
            if (this.stateMachine.currentState?.Name !== 'flee') {
                this.stateMachine.SetState('flee');
            }
        }
    }

    OnDeath() {
        // Remove physics collider
        if (this.ghostObj && this.physicsWorld) {
            try {
                AmmoHelper.UnregisterCollisionEntity(this.ghostObj);
                // Use the correct Ammo.js method
                if (typeof this.physicsWorld.removeCollisionObject === 'function') {
                    this.physicsWorld.removeCollisionObject(this.ghostObj);
                } else if (typeof this.physicsWorld.getWorld === 'function') {
                    this.physicsWorld.getWorld().removeCollisionObject(this.ghostObj);
                }
            } catch (e) {
                console.warn('Failed to remove collision object:', e);
            }
            this.ghostObj = null;
        }
    }

    CreateBloodPool() {
        // Create a simple red circle on the ground
        const geometry = new THREE.CircleGeometry(0.8, 16);
        const material = new THREE.MeshBasicMaterial({
            color: 0x8B0000,
            transparent: true,
            opacity: 0.8,
            side: THREE.DoubleSide
        });
        const bloodPool = new THREE.Mesh(geometry, material);
        bloodPool.rotation.x = -Math.PI / 2;
        bloodPool.position.copy(this.model.position);
        bloodPool.position.y = 0.01; // Just above ground
        this.scene.add(bloodPool);
    }

    Cleanup() {
        // Called when entity is removed
        if (this.ghostObj && this.physicsWorld) {
            try {
                AmmoHelper.UnregisterCollisionEntity(this.ghostObj);
                if (typeof this.physicsWorld.removeCollisionObject === 'function') {
                    this.physicsWorld.removeCollisionObject(this.ghostObj);
                }
            } catch (e) {
                // Ignore cleanup errors
            }
            this.ghostObj = null;
        }
        if (this.model) {
            this.scene.remove(this.model);
        }
    }

    Update(t) {
        if (!this.initialized) return;

        // Update animations
        if (this.mixer) {
            this.mixer.update(t);
        }

        if (this.isDead) {
            // Just update death animation
            this.stateMachine?.Update(t);
            return;
        }

        this.MoveAlongPath(t);
        this.stateMachine?.Update(t);
        this.UpdateColliderPosition();

        // Sync entity position
        this.parent.SetPosition(this.model.position);
        this.parent.SetRotation(this.model.quaternion);
    }
}
