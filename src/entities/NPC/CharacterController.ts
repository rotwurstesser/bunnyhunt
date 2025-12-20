/**
 * Character Controller (Mutant)
 *
 * Controller for the mutant enemy.
 * Uses FBX animations with root bone motion.
 *
 * Key differences from AnimalController:
 * - Uses FBX separate animation files (not GLTF embedded)
 * - Uses root bone motion for movement (animation-driven)
 * - Has skeletal collision via CharacterCollision component
 */

import * as THREE from 'three';
import Component from '../../core/Component';
import { Ammo, AmmoHelper, CollisionFilterGroups } from '../../core/AmmoLib';
import CharacterFSM, { type MutantState } from './CharacterFSM';
import type { HitEvent, AnimalKilledEvent } from '../../types/events.types';
import type { IEntity } from '../../types/entity.types';

// ============================================================================
// TYPES
// ============================================================================

/** Animation clip dictionary - maps name to clip */
export type AnimationClipDict = Record<string, THREE.AnimationClip>;

/** Animation reference stored on controller */
export interface CharacterAnimation {
  clip: THREE.AnimationClip;
  action: THREE.AnimationAction;
}

/** Navmesh component interface */
interface NavmeshComponent {
  GetRandomNode(position: THREE.Vector3, radius: number): THREE.Vector3 | null;
  FindPath(from: THREE.Vector3, to: THREE.Vector3): THREE.Vector3[] | null;
}

/** AttackTrigger component interface */
interface AttackTriggerComponent {
  overlapping: boolean;
}

/** PlayerPhysics component interface */
interface PlayerPhysicsComponent {
  body: unknown;
}

// ============================================================================
// CHARACTER CONTROLLER
// ============================================================================

export default class CharacterController extends Component {
  override name = 'CharacterController';

  // ============================================================================
  // DEPENDENCIES
  // ============================================================================

  private readonly scene: THREE.Scene;
  private readonly physicsWorld: unknown;

  // ============================================================================
  // MODEL & ANIMATIONS
  // ============================================================================

  /** The 3D model (cloned from SkeletonUtils) */
  public readonly model: THREE.Object3D;

  /** Animation clips passed from entry.js */
  private readonly clips: AnimationClipDict;

  /** Animation mixer */
  public mixer: THREE.AnimationMixer | null = null;

  /** Animations map */
  public animations: Record<string, CharacterAnimation | undefined> = {};

  // ============================================================================
  // STATE
  // ============================================================================

  /** Current navigation path */
  public path: THREE.Vector3[] = [];

  /** State machine */
  private stateMachine: CharacterFSM | null = null;

  /** Whether movement is enabled */
  public canMove: boolean = true;

  /** Current health */
  public health: number = 100;

  /** View angle (cosine of 45 degrees) */
  private readonly viewAngle: number = Math.cos(Math.PI / 4.0);

  /** Max view distance squared */
  private readonly maxViewDistance: number = 20.0 * 20.0;

  /** Attack distance */
  private readonly attackDistance: number = 2.2;

  // ============================================================================
  // REFERENCES
  // ============================================================================

  private navmesh: NavmeshComponent | null = null;
  private hitbox: AttackTriggerComponent | null = null;
  private player: IEntity | null = null;

  // ============================================================================
  // ROOT BONE MOTION
  // ============================================================================

  private skinnedMesh: THREE.SkinnedMesh | null = null;
  private rootBone: THREE.Bone & { refPos?: THREE.Vector3 } | null = null;
  private lastPos: THREE.Vector3 = new THREE.Vector3();

  // ============================================================================
  // TEMP OBJECTS
  // ============================================================================

  private readonly dir: THREE.Vector3 = new THREE.Vector3();
  private readonly forwardVec: THREE.Vector3 = new THREE.Vector3(0, 0, 1);
  private readonly tempVec: THREE.Vector3 = new THREE.Vector3();
  private readonly tempRot: THREE.Quaternion = new THREE.Quaternion();

  // ============================================================================
  // CONSTRUCTOR
  // ============================================================================

  constructor(
    model: THREE.Object3D,
    clips: AnimationClipDict,
    scene: THREE.Scene,
    physicsWorld: unknown
  ) {
    super();
    this.model = model;
    this.clips = clips;
    this.scene = scene;
    this.physicsWorld = physicsWorld;
  }

  // ============================================================================
  // ANIMATION SETUP
  // ============================================================================

  private setAnim(name: string, clip: THREE.AnimationClip): void {
    if (!this.mixer) return;
    const action = this.mixer.clipAction(clip);
    this.animations[name] = { clip, action };
  }

  private setupAnimations(): void {
    Object.keys(this.clips).forEach((key) => {
      this.setAnim(key, this.clips[key]);
    });
  }

  // ============================================================================
  // INITIALIZATION
  // ============================================================================

  override Initialize(): void {
    // Create state machine
    this.stateMachine = new CharacterFSM(this);

    // Get references
    const level = this.FindEntity('Level');
    this.navmesh = level?.GetComponent('Navmesh') as NavmeshComponent | undefined ?? null;
    this.hitbox = this.GetComponent('AttackTrigger') as AttackTriggerComponent | undefined ?? null;
    this.player = this.FindEntity('Player') ?? null;

    // Register hit event
    this.parent!.RegisterEventHandler(this.TakeHit, 'hit');

    // Setup model
    this.model.scale.setScalar(0.01);
    this.model.position.copy(this.parent!.position);

    // Create mixer
    this.mixer = new THREE.AnimationMixer(this.model);

    // Find skinned mesh and root bone
    this.model.traverse((child) => {
      if ((child as THREE.SkinnedMesh).isSkinnedMesh) {
        const mesh = child as THREE.SkinnedMesh;
        mesh.frustumCulled = false;
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        this.skinnedMesh = mesh;

        // Find root bone for root motion
        const hips = mesh.skeleton.bones.find((bone) => bone.name === 'MutantHips');
        if (hips) {
          this.rootBone = hips as THREE.Bone & { refPos?: THREE.Vector3 };
          this.rootBone.refPos = this.rootBone.position.clone();
          this.lastPos.copy(this.rootBone.position);
        }
      }
    });

    // Setup animations
    this.setupAnimations();

    // Add to scene
    this.scene.add(this.model);

    // Start in idle state
    this.stateMachine.SetState('idle');
  }

  // ============================================================================
  // DIRECTION
  // ============================================================================

  updateDirection(): void {
    this.dir.copy(this.forwardVec);
    this.dir.applyQuaternion(this.parent!.rotation);
  }

  // ============================================================================
  // VISION
  // ============================================================================

  CanSeeThePlayer(): boolean {
    if (!this.player) return false;

    const playerPos = this.player.Position.clone();
    const modelPos = this.model.position.clone();
    modelPos.y += 1.35;

    const charToPlayer = playerPos.sub(modelPos);

    // Distance check
    if (charToPlayer.lengthSq() > this.maxViewDistance) {
      return false;
    }

    charToPlayer.normalize();
    const angle = charToPlayer.dot(this.dir);

    // Angle check
    if (angle < this.viewAngle) {
      return false;
    }

    // Raycast check
    const rayInfo: { collisionObject?: unknown } = {};
    const collisionMask = CollisionFilterGroups.AllFilter & ~CollisionFilterGroups.SensorTrigger;

    if (AmmoHelper.CastRay(this.physicsWorld, modelPos, this.player.Position, rayInfo, collisionMask)) {
      const body = Ammo.castObject(rayInfo.collisionObject, Ammo.btRigidBody);
      const playerPhysics = this.player.GetComponent('PlayerPhysics') as PlayerPhysicsComponent | undefined;

      if (playerPhysics && body === playerPhysics.body) {
        return true;
      }
    }

    return false;
  }

  // ============================================================================
  // NAVIGATION
  // ============================================================================

  NavigateToRandomPoint(): void {
    if (!this.navmesh) return;
    const node = this.navmesh.GetRandomNode(this.model.position, 50);
    if (node) {
      this.path = this.navmesh.FindPath(this.model.position, node) ?? [];
    }
  }

  NavigateToPlayer(): void {
    if (!this.navmesh || !this.player) return;

    this.tempVec.copy(this.player.Position);
    this.tempVec.y = 0.5;
    this.path = this.navmesh.FindPath(this.model.position, this.tempVec) ?? [];
  }

  FacePlayer(deltaTime: number, rate: number = 3.0): void {
    if (!this.player) return;

    this.tempVec.copy(this.player.Position).sub(this.model.position);
    this.tempVec.y = 0.0;
    this.tempVec.normalize();

    this.tempRot.setFromUnitVectors(this.forwardVec, this.tempVec);
    this.model.quaternion.rotateTowards(this.tempRot, rate * deltaTime);
  }

  // ============================================================================
  // DISTANCE CHECKS
  // ============================================================================

  get IsCloseToPlayer(): boolean {
    if (!this.player) return false;

    this.tempVec.copy(this.player.Position).sub(this.model.position);
    return this.tempVec.lengthSq() <= this.attackDistance * this.attackDistance;
  }

  get IsPlayerInHitbox(): boolean {
    return this.hitbox?.overlapping ?? false;
  }

  // ============================================================================
  // ATTACK
  // ============================================================================

  HitPlayer(): void {
    this.player?.Broadcast({ topic: 'hit', amount: 10 });
  }

  // ============================================================================
  // DAMAGE
  // ============================================================================

  TakeHit = (msg: HitEvent): void => {
    this.health = Math.max(0, this.health - msg.amount);

    if (this.health === 0) {
      this.stateMachine?.SetState('dead');

      // Notify GameManager
      const gameManager = this.FindEntity('GameManager');
      if (gameManager) {
        const event: AnimalKilledEvent = {
          topic: 'animal_killed',
          entity: this.parent!,
          type: 'mutant',
        };
        gameManager.Broadcast(event);
      }
    } else {
      // Become aggressive
      const stateName = this.stateMachine?.currentState?.Name;
      if (stateName === 'idle' || stateName === 'patrol') {
        this.stateMachine?.SetState('chase');
      }
    }
  };

  // ============================================================================
  // MOVEMENT
  // ============================================================================

  MoveAlongPath(deltaTime: number): void {
    if (!this.path?.length) return;

    const target = this.path[0].clone().sub(this.model.position);
    target.y = 0.0;

    if (target.lengthSq() > 0.1 * 0.1) {
      target.normalize();
      this.tempRot.setFromUnitVectors(this.forwardVec, target);
      this.model.quaternion.slerp(this.tempRot, 4.0 * deltaTime);
    } else {
      // Remove waypoint
      this.path.shift();

      if (this.path.length === 0) {
        this.Broadcast({ topic: 'nav.end', agent: this });
      }
    }
  }

  ClearPath(): void {
    if (this.path) {
      this.path.length = 0;
    }
  }

  // ============================================================================
  // ROOT MOTION
  // ============================================================================

  private applyRootMotion(): void {
    if (!this.rootBone) return;

    if (this.canMove) {
      const vel = this.rootBone.position.clone();
      vel.sub(this.lastPos).multiplyScalar(0.01);
      vel.y = 0;

      vel.applyQuaternion(this.model.quaternion);

      if (vel.lengthSq() < 0.1 * 0.1) {
        this.model.position.add(vel);
      }
    }

    // Reset root bone horizontal position
    this.lastPos.copy(this.rootBone.position);
    if (this.rootBone.refPos) {
      this.rootBone.position.z = this.rootBone.refPos.z;
      this.rootBone.position.x = this.rootBone.refPos.x;
    }
  }

  // ============================================================================
  // UPDATE
  // ============================================================================

  override Update(deltaTime: number): void {
    this.mixer?.update(deltaTime);
    this.applyRootMotion();

    this.updateDirection();
    this.MoveAlongPath(deltaTime);
    this.stateMachine?.Update(deltaTime);

    this.parent!.SetRotation(this.model.quaternion);
    this.parent!.SetPosition(this.model.position);
  }

  // ============================================================================
  // CLEANUP
  // ============================================================================

  override Cleanup(): void {
    if (this.model && this.scene) {
      this.scene.remove(this.model);
    }
  }
}
