/**
 * Player Controls Component
 *
 * Handles player movement, camera rotation, and jumping.
 * Uses pointer lock for FPS-style mouse look.
 */

import * as THREE from 'three';
import Component from '../../core/Component';
import Input from '../../core/Input';
import { Ammo } from '../../core/AmmoLib';

// ============================================================================
// TYPES
// ============================================================================

/** Player physics component interface */
interface PlayerPhysicsComponent {
  body: AmmoRigidBody;
  canJump: boolean;
}

/** Ammo.js rigid body interface */
interface AmmoRigidBody {
  getLinearVelocity(): AmmoVector3;
  setLinearVelocity(velocity: AmmoVector3): void;
  setAngularVelocity(velocity: AmmoVector3): void;
  getMotionState(): AmmoMotionState | null;
}

/** Ammo.js vector3 interface */
interface AmmoVector3 {
  x(): number;
  y(): number;
  z(): number;
  setX(x: number): void;
  setY(y: number): void;
  setZ(z: number): void;
}

/** Ammo.js motion state interface */
interface AmmoMotionState {
  getWorldTransform(transform: AmmoTransform): void;
}

/** Ammo.js transform interface */
interface AmmoTransform {
  getOrigin(): AmmoVector3Origin;
}

/** Ammo.js vector3 origin interface (different from btVector3) */
interface AmmoVector3Origin {
  x(): number;
  y(): number;
  z(): number;
}

// ============================================================================
// PLAYER CONTROLS COMPONENT
// ============================================================================

export default class PlayerControls extends Component {
  override name = 'PlayerControls';

  // ============================================================================
  // DEPENDENCIES
  // ============================================================================

  private readonly camera: THREE.Camera;

  // ============================================================================
  // MOVEMENT CONFIG
  // ============================================================================

  /** Time to reach max speed */
  private readonly timeZeroToMax: number = 0.08;

  /** Maximum movement speed */
  private readonly maxSpeed: number = 7.0;

  /** Acceleration rate */
  private readonly acceleration: number;

  /** Deceleration rate (friction) */
  private readonly deceleration: number = -7.0;

  /** Jump velocity */
  private readonly jumpVelocity: number = 5;

  /** Camera Y offset above physics body */
  private readonly yOffset: number = 0.5;

  /** Mouse sensitivity */
  private readonly mouseSpeed: number = 0.002;

  // ============================================================================
  // STATE
  // ============================================================================

  /** Current velocity */
  private readonly speed: THREE.Vector3 = new THREE.Vector3();

  /** Current rotation angles (pitch and yaw) */
  private readonly angles: THREE.Euler = new THREE.Euler();

  /** Pitch quaternion (x-axis rotation) */
  private readonly pitch: THREE.Quaternion = new THREE.Quaternion();

  /** Yaw quaternion (y-axis rotation) */
  private readonly yaw: THREE.Quaternion = new THREE.Quaternion();

  /** X-axis for pitch rotation */
  private readonly xAxis: THREE.Vector3 = new THREE.Vector3(1.0, 0.0, 0.0);

  /** Y-axis for yaw rotation */
  private readonly yAxis: THREE.Vector3 = new THREE.Vector3(0.0, 1.0, 0.0);

  /** Whether pointer is locked */
  private isLocked: boolean = false;

  // ============================================================================
  // PHYSICS REFERENCES
  // ============================================================================

  private physicsComponent: PlayerPhysicsComponent | null = null;
  private physicsBody: AmmoRigidBody | null = null;
  private transform: AmmoTransform | null = null;
  private zeroVec: AmmoVector3 | null = null;

  // ============================================================================
  // TEMP OBJECTS
  // ============================================================================

  private readonly tempVec: THREE.Vector3 = new THREE.Vector3();
  private readonly moveDir: THREE.Vector3 = new THREE.Vector3();

  // ============================================================================
  // CONSTRUCTOR
  // ============================================================================

  constructor(camera: THREE.Camera) {
    super();
    this.camera = camera;
    this.acceleration = this.maxSpeed / this.timeZeroToMax;
  }

  // ============================================================================
  // INITIALIZATION
  // ============================================================================

  override Initialize(): void {
    // Get physics component
    this.physicsComponent = this.GetComponent('PlayerPhysics') as PlayerPhysicsComponent | undefined ?? null;
    if (!this.physicsComponent) {
      console.error('PlayerControls: PlayerPhysics component not found');
      return;
    }

    this.physicsBody = this.physicsComponent.body;

    // Create Ammo objects
    this.transform = new Ammo.btTransform();
    this.zeroVec = new Ammo.btVector3(0.0, 0.0, 0.0);

    // Initialize rotation from parent
    this.angles.setFromQuaternion(this.parent!.Rotation);
    this.updateRotation();

    // Setup input listeners
    Input.AddMouseMoveListner(this.onMouseMove);

    document.addEventListener('pointerlockchange', this.onPointerLockChange);

    Input.AddClickListner(() => {
      if (!this.isLocked) {
        document.body.requestPointerLock();
      }
    });
  }

  // ============================================================================
  // INPUT HANDLERS
  // ============================================================================

  private onPointerLockChange = (): void => {
    this.isLocked = document.pointerLockElement !== null;
  };

  private onMouseMove = (event: MouseEvent): void => {
    if (!this.isLocked) return;

    const { movementX, movementY } = event;

    this.angles.y -= movementX * this.mouseSpeed;
    this.angles.x -= movementY * this.mouseSpeed;

    // Clamp pitch to prevent flipping
    this.angles.x = Math.max(-Math.PI / 2, Math.min(Math.PI / 2, this.angles.x));

    this.updateRotation();
  };

  // ============================================================================
  // ROTATION
  // ============================================================================

  private updateRotation(): void {
    this.pitch.setFromAxisAngle(this.xAxis, this.angles.x);
    this.yaw.setFromAxisAngle(this.yAxis, this.angles.y);

    this.parent!.Rotation.multiplyQuaternions(this.yaw, this.pitch).normalize();
    this.camera.quaternion.copy(this.parent!.Rotation);
  }

  // ============================================================================
  // MOVEMENT
  // ============================================================================

  private accelerate(direction: THREE.Vector3, deltaTime: number): void {
    const accel = this.tempVec.copy(direction).multiplyScalar(this.acceleration * deltaTime);
    this.speed.add(accel);
    this.speed.clampLength(0.0, this.maxSpeed);
  }

  private decelerate(deltaTime: number): void {
    const frameDecel = this.tempVec.copy(this.speed).multiplyScalar(this.deceleration * deltaTime);
    this.speed.add(frameDecel);
  }

  // ============================================================================
  // UPDATE
  // ============================================================================

  override Update(deltaTime: number): void {
    if (!this.physicsBody || !this.physicsComponent) return;

    // Get input direction
    const forwardFactor = Input.GetKeyDown('KeyS') - Input.GetKeyDown('KeyW');
    const rightFactor = Input.GetKeyDown('KeyD') - Input.GetKeyDown('KeyA');
    const direction = this.moveDir.set(rightFactor, 0.0, forwardFactor).normalize();

    const velocity = this.physicsBody.getLinearVelocity();

    // Handle jump
    if (Input.GetKeyDown('Space') && this.physicsComponent.canJump) {
      velocity.setY(this.jumpVelocity);
      this.physicsComponent.canJump = false;
    }

    // Apply movement
    this.decelerate(deltaTime);
    this.accelerate(direction, deltaTime);

    const moveVector = this.tempVec.copy(this.speed);
    moveVector.applyQuaternion(this.yaw);

    velocity.setX(moveVector.x);
    velocity.setZ(moveVector.z);

    this.physicsBody.setLinearVelocity(velocity);
    this.physicsBody.setAngularVelocity(this.zeroVec!);

    // Update camera position from physics body
    const ms = this.physicsBody.getMotionState();
    if (ms && this.transform) {
      ms.getWorldTransform(this.transform);
      const p = this.transform.getOrigin();
      (this.camera as THREE.PerspectiveCamera).position.set(
        p.x(),
        p.y() + this.yOffset,
        p.z()
      );
      this.parent!.SetPosition((this.camera as THREE.PerspectiveCamera).position);
    }
  }

  // ============================================================================
  // CLEANUP
  // ============================================================================

  override Cleanup(): void {
    document.removeEventListener('pointerlockchange', this.onPointerLockChange);
  }
}
