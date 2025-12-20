/**
 * Character Collision Component
 *
 * Creates per-bone collision capsules for the mutant character.
 * Updates each frame to follow skeleton animation.
 */

import * as THREE from 'three';
import Component from '../../core/Component';
import { Ammo, AmmoHelper } from '../../core/AmmoLib';

// ============================================================================
// TYPES
// ============================================================================

/** Bone collision definition */
interface BoneCollisionDef {
  rotation: { x: number; y: number; z: number };
  position: { x: number; y: number; z: number };
  radius: number;
  height: number;
}

/** Runtime bone collision data */
interface BoneCollision extends BoneCollisionDef {
  bone: THREE.Bone | null;
  object: unknown | null;
  localTransform: unknown | null;
}

/** CharacterController interface */
interface CharacterControllerComponent {
  model: THREE.Object3D;
}

// ============================================================================
// BONE COLLISION DEFINITIONS
// ============================================================================

const BONE_COLLISIONS: Record<string, BoneCollisionDef> = {
  MutantLeftArm: {
    rotation: { x: -0.1, y: 0.0, z: Math.PI * 0.5 },
    position: { x: 0.13, y: -0.04, z: 0.0 },
    radius: 0.13,
    height: 0.13,
  },
  MutantLeftForeArm: {
    rotation: { x: -0.1, y: 0.0, z: Math.PI * 0.5 },
    position: { x: 0.3, y: 0.0, z: -0.05 },
    radius: 0.2,
    height: 0.3,
  },
  MutantRightArm: {
    rotation: { x: 0.1, y: 0.0, z: Math.PI * 0.5 },
    position: { x: -0.13, y: -0.04, z: 0.0 },
    radius: 0.13,
    height: 0.13,
  },
  MutantRightForeArm: {
    rotation: { x: 0.1, y: 0.0, z: Math.PI * 0.5 },
    position: { x: -0.3, y: 0.0, z: -0.05 },
    radius: 0.2,
    height: 0.3,
  },
  MutantSpine: {
    rotation: { x: 0.0, y: 0.0, z: 0.0 },
    position: { x: 0.0, y: 0.25, z: 0.0 },
    radius: 0.25,
    height: 0.5,
  },
  MutantLeftUpLeg: {
    rotation: { x: -0.1, y: 0.0, z: 0.1 },
    position: { x: -0.02, y: -0.12, z: 0.0 },
    radius: 0.16,
    height: 0.24,
  },
  MutantRightUpLeg: {
    rotation: { x: -0.1, y: 0.0, z: -0.1 },
    position: { x: 0.02, y: -0.12, z: 0.0 },
    radius: 0.16,
    height: 0.24,
  },
  MutantLeftLeg: {
    rotation: { x: 0.13, y: 0.0, z: 0.0 },
    position: { x: 0.02, y: -0.12, z: 0.0 },
    radius: 0.14,
    height: 0.24,
  },
  MutantRightLeg: {
    rotation: { x: 0.13, y: 0.0, z: 0.0 },
    position: { x: -0.02, y: -0.12, z: 0.0 },
    radius: 0.14,
    height: 0.24,
  },
};

// ============================================================================
// CHARACTER COLLISION COMPONENT
// ============================================================================

export default class CharacterCollision extends Component {
  override name = 'CharacterCollision';

  // ============================================================================
  // DEPENDENCIES
  // ============================================================================

  private readonly world: unknown;

  // ============================================================================
  // STATE
  // ============================================================================

  private collisions: Record<string, BoneCollision> = {};
  private mesh: THREE.SkinnedMesh | null = null;

  // ============================================================================
  // TEMP OBJECTS
  // ============================================================================

  private readonly bonePos: THREE.Vector3 = new THREE.Vector3();
  private readonly boneRot: THREE.Quaternion = new THREE.Quaternion();
  private globalRot: unknown | null = null;

  // ============================================================================
  // CONSTRUCTOR
  // ============================================================================

  constructor(physicsWorld: unknown) {
    super();
    this.world = physicsWorld;
  }

  // ============================================================================
  // INITIALIZATION
  // ============================================================================

  override Initialize(): void {
    // Create temp quaternion
    this.globalRot = new Ammo.btQuaternion();

    // Get character controller
    const controller = this.GetComponent('CharacterController') as CharacterControllerComponent | undefined;
    if (!controller) {
      console.error('CharacterCollision: CharacterController not found');
      return;
    }

    // Find skinned mesh
    controller.model.traverse((child) => {
      if ((child as THREE.SkinnedMesh).isSkinnedMesh) {
        this.mesh = child as THREE.SkinnedMesh;
      }
    });

    if (!this.mesh) {
      console.error('CharacterCollision: SkinnedMesh not found');
      return;
    }

    // Create collision objects for each bone
    Object.keys(BONE_COLLISIONS).forEach((boneName) => {
      const def = BONE_COLLISIONS[boneName];

      // Find bone
      const bone = this.mesh!.skeleton.bones.find((b) => b.name === boneName) ?? null;
      if (!bone) {
        console.warn(`CharacterCollision: Bone ${boneName} not found`);
        return;
      }

      // Create capsule shape
      const shape = new Ammo.btCapsuleShape(def.radius, def.height);
      const ghostObj = AmmoHelper.CreateTrigger(shape);
      (ghostObj as { parentEntity?: unknown }).parentEntity = this.parent;

      // Create local transform
      const localRot = new Ammo.btQuaternion();
      localRot.setEulerZYX(def.rotation.z, def.rotation.y, def.rotation.x);
      const localTransform = new Ammo.btTransform();
      localTransform.setIdentity();
      localTransform.setRotation(localRot);
      localTransform.getOrigin().setValue(def.position.x, def.position.y, def.position.z);

      // Add to physics world
      const world = this.world as { addCollisionObject(obj: unknown): void };
      world.addCollisionObject(ghostObj);

      // Store collision data
      this.collisions[boneName] = {
        ...def,
        bone,
        object: ghostObj,
        localTransform,
      };
    });
  }

  // ============================================================================
  // UPDATE
  // ============================================================================

  override Update(_deltaTime: number): void {
    if (!this.globalRot) return;

    Object.keys(this.collisions).forEach((boneName) => {
      const collision = this.collisions[boneName];
      if (!collision.bone || !collision.object) return;

      const ghostObj = collision.object as {
        getWorldTransform(): {
          getOrigin(): { setValue(x: number, y: number, z: number): void };
          setRotation(q: unknown): void;
          op_mul(t: unknown): void;
        };
      };
      const transform = ghostObj.getWorldTransform();

      // Get bone world position and rotation
      collision.bone.getWorldPosition(this.bonePos);
      collision.bone.getWorldQuaternion(this.boneRot);

      // Update global rotation
      const globalRot = this.globalRot as {
        setValue(x: number, y: number, z: number, w: number): void;
      };
      globalRot.setValue(this.boneRot.x, this.boneRot.y, this.boneRot.z, this.boneRot.w);

      // Update transform
      transform.getOrigin().setValue(this.bonePos.x, this.bonePos.y, this.bonePos.z);
      transform.setRotation(this.globalRot);
      transform.op_mul(collision.localTransform);
    });
  }

  // ============================================================================
  // CLEANUP
  // ============================================================================

  override Cleanup(): void {
    // Remove collision objects from world
    Object.keys(this.collisions).forEach((boneName) => {
      const collision = this.collisions[boneName];
      if (collision.object && this.world) {
        try {
          const world = this.world as { removeCollisionObject?(obj: unknown): void };
          if (typeof world.removeCollisionObject === 'function') {
            world.removeCollisionObject(collision.object);
          }
        } catch (e) {
          // Ignore cleanup errors
        }
      }
    });
  }
}
