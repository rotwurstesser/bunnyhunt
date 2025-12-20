import * as THREE from 'three'
import Component from '../../Component'
import { Ammo, AmmoHelper, CollisionFilterGroups } from '../../AmmoLib'
import FoxFSM from './FoxFSM'

export default class FoxController extends Component {
    constructor(model, scene, physicsWorld) {
        super();
        this.name = 'FoxController';
        this.animalType = 'fox';
        this.physicsWorld = physicsWorld;
        this.scene = scene;
        this.model = model;
        this.path = [];
        this.tempRot = new THREE.Quaternion();
        this.forwardVec = new THREE.Vector3(0, 0, 1);
        this.tempVec = new THREE.Vector3();

        // Fox-specific settings
        this.health = 30;
        this.speed = 6.0;
        this.chaseSpeed = 10.0;
        this.viewDistance = 25.0;
        this.viewAngle = Math.cos(Math.PI / 3); // 60 degrees
        this.attackDistance = 2.0;
        this.attackDamage = 15;
        this.baseScale = 0.5; // Smaller fox (1/3 of original 1.5)
        this.isDead = false;
        this.mixer = null;
        this.currentAction = null;
        this.initialized = false;
    }

    Initialize() {
        // Prevent double initialization
        if (this.initialized) return;
        this.initialized = true;

        this.stateMachine = new FoxFSM(this);
        const level = this.FindEntity('Level');
        this.navmesh = level?.GetComponent('Navmesh');
        this.player = this.FindEntity("Player");

        if (!this.navmesh) {
            console.warn('FoxController: Navmesh not found');
        }

        // Register for hit events
        this.parent.RegisterEventHandler(this.TakeHit, 'hit');

        // Setup model
        this.model.scale.setScalar(this.baseScale);
        this.model.position.copy(this.parent.position);

        // Setup animations
        this.SetupAnimations();

        // Ensure shadows
        this.model.traverse(child => {
            if (child.isMesh) {
                child.castShadow = true;
                child.receiveShadow = true;
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
            // Fox animations: Attack, Death, Eating, Gallop, Idle, Walk, etc.
            animations.forEach((clip, index) => {
                const name = clip.name.toLowerCase();
                if (name.includes('idle') && !name.includes('react')) {
                    this.animations.idle = clip;
                } else if (name.includes('gallop') && !name.includes('jump')) {
                    this.animations.run = clip;
                } else if (name.includes('walk')) {
                    this.animations.walk = clip;
                } else if (name.includes('attack')) {
                    this.animations.attack = clip;
                } else if (name.includes('death')) {
                    this.animations.die = clip;
                }
            });

            // Fallback: use walk for run if no gallop
            if (!this.animations.run && this.animations.walk) {
                this.animations.run = this.animations.walk;
            }

            // Start with idle animation
            if (this.animations.idle) {
                this.currentAction = this.mixer.clipAction(this.animations.idle);
                this.currentAction.play();
            }
        }
    }

    PlayAnimation(name) {
        if (!this.mixer || !this.animations?.[name]) return;

        const clip = this.animations[name];
        if (this.currentAction) {
            const newAction = this.mixer.clipAction(clip);
            newAction.reset();
            newAction.crossFadeFrom(this.currentAction, 0.2, true);
            newAction.play();
            this.currentAction = newAction;
        } else {
            this.currentAction = this.mixer.clipAction(clip);
            this.currentAction.play();
        }
    }

    CreateCollider() {
        // Collider sized for scaled fox (~3 units tall after scaling)
        const shape = new Ammo.btSphereShape(1.0);
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
            transform.getOrigin().setValue(pos.x, pos.y + 0.4, pos.z);
        }
    }

    CanSeePlayer() {
        if (!this.player) return false;

        const playerPos = this.player.Position.clone();
        const foxPos = this.model.position.clone();
        foxPos.y += 0.5;

        const toPlayer = playerPos.clone().sub(foxPos);
        const distSq = toPlayer.lengthSq();

        // Distance check
        if (distSq > this.viewDistance * this.viewDistance) {
            return false;
        }

        // Angle check
        toPlayer.normalize();
        const forward = this.forwardVec.clone().applyQuaternion(this.model.quaternion);
        const dot = toPlayer.dot(forward);

        if (dot < this.viewAngle) {
            return false;
        }

        // Raycast check (can see through walls?)
        const rayInfo = {};
        const collisionMask = CollisionFilterGroups.AllFilter & ~CollisionFilterGroups.SensorTrigger;

        if (AmmoHelper.CastRay(this.physicsWorld, foxPos, playerPos, rayInfo, collisionMask)) {
            const body = Ammo.castObject(rayInfo.collisionObject, Ammo.btRigidBody);
            const playerBody = this.player.GetComponent('PlayerPhysics')?.body;
            if (body === playerBody) {
                return true;
            }
        }

        return false;
    }

    IsCloseToPlayer() {
        if (!this.player) return false;
        const dist = this.model.position.distanceTo(this.player.Position);
        return dist < this.attackDistance;
    }

    NavigateToRandomPoint() {
        if (!this.navmesh) return;
        const node = this.navmesh.GetRandomNode(this.model.position, 30);
        if (node) {
            this.path = this.navmesh.FindPath(this.model.position, node) || [];
        }
    }

    NavigateToPlayer() {
        if (!this.player || !this.navmesh) return;
        this.tempVec.copy(this.player.Position);
        this.tempVec.y = this.model.position.y;
        this.path = this.navmesh.FindPath(this.model.position, this.tempVec) || [];
    }

    ClearPath() {
        this.path = [];
    }

    FacePlayer(t, rate = 3.0) {
        if (!this.player) return;
        this.tempVec.copy(this.player.Position).sub(this.model.position);
        this.tempVec.y = 0;
        if (this.tempVec.lengthSq() < 0.001) return;
        this.tempVec.normalize();
        this.tempRot.setFromUnitVectors(this.forwardVec, this.tempVec);
        this.model.quaternion.slerp(this.tempRot, rate * t);
    }

    HitPlayer() {
        if (this.player) {
            this.player.Broadcast({ topic: 'hit', amount: this.attackDamage });
        }
    }

    MoveAlongPath(t) {
        if (!this.path?.length || this.isDead) return;

        const target = this.path[0].clone().sub(this.model.position);
        target.y = 0;

        // Determine speed based on state
        const currentState = this.stateMachine.currentState?.Name;
        const moveSpeed = currentState === 'chase' ? this.chaseSpeed : this.speed;

        if (target.lengthSq() > 0.3 * 0.3) {
            // Move towards target
            target.normalize();

            // Rotate to face movement direction
            this.tempRot.setFromUnitVectors(this.forwardVec, target);
            this.model.quaternion.slerp(this.tempRot, 6.0 * t);

            // Move forward
            const moveAmount = moveSpeed * t;
            this.model.position.add(target.multiplyScalar(moveAmount));
        } else {
            // Reached waypoint
            this.path.shift();
        }
    }

    TakeHit = (msg) => {
        if (this.isDead) return;

        this.health = Math.max(0, this.health - msg.amount);

        if (this.health <= 0) {
            this.isDead = true;
            this.stateMachine.SetState('dead');

            // Notify GameManager
            const gameManager = this.FindEntity("GameManager");
            if (gameManager) {
                gameManager.Broadcast({
                    topic: 'animal_killed',
                    entity: this.parent,
                    type: 'fox'
                });
            }

            // Notify SpawnManager for respawn
            const spawnManager = this.FindEntity("SpawnManager");
            if (spawnManager) {
                spawnManager.Broadcast({
                    topic: 'animal_died',
                    entity: this.parent,
                    type: 'fox',
                    position: this.model.position.clone()
                });
            }
        } else {
            // Got hit but not dead - become aggressive!
            const currentState = this.stateMachine.currentState?.Name;
            if (currentState !== 'chase' && currentState !== 'attack') {
                this.stateMachine.SetState('chase');
            }
        }
    }

    OnDeath() {
        if (this.ghostObj) {
            AmmoHelper.UnregisterCollisionEntity(this.ghostObj);
            this.physicsWorld.removeCollisionObject(this.ghostObj);
        }
    }

    Cleanup() {
        if (this.ghostObj) {
            AmmoHelper.UnregisterCollisionEntity(this.ghostObj);
            this.physicsWorld.removeCollisionObject(this.ghostObj);
        }
        this.scene.remove(this.model);
    }

    Update(t) {
        // Update animations
        if (this.mixer) {
            this.mixer.update(t);
        }

        if (this.isDead) {
            this.stateMachine.Update(t);
            return;
        }

        this.MoveAlongPath(t);
        this.stateMachine.Update(t);
        this.UpdateColliderPosition();

        // Sync entity position
        this.parent.SetPosition(this.model.position);
        this.parent.SetRotation(this.model.quaternion);
    }
}
