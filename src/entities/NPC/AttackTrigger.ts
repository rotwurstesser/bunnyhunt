/**
 * Attack Trigger Component
 *
 * Sphere trigger for detecting when player is within attack range.
 * Used by CharacterController to determine if attack can hit.
 */

import Component from '../../core/Component';
import { Ammo, AmmoHelper, CollisionFilterGroups } from '../../core/AmmoLib';

// ============================================================================
// TYPES
// ============================================================================

/** Ammo.js transform interface */
interface AmmoTransform {
  setRotation(quat: AmmoQuaternion): void;
  getOrigin(): { setValue(x: number, y: number, z: number): void };
  op_mul(other: AmmoTransform): void;
}

/** Ammo.js quaternion interface */
interface AmmoQuaternion {
  setValue(x: number, y: number, z: number, w: number): void;
}

/** Ammo.js ghost object interface */
interface AmmoGhostObject {
  getWorldTransform(): AmmoTransform;
}

/** Player physics component interface */
interface PlayerPhysicsComponent {
  body: unknown;
}

// ============================================================================
// ATTACK TRIGGER COMPONENT
// ============================================================================

export default class AttackTrigger extends Component {
  override name = 'AttackTrigger';

  // ============================================================================
  // DEPENDENCIES
  // ============================================================================

  private readonly physicsWorld: unknown;

  // ============================================================================
  // STATE
  // ============================================================================

  /** Local transform offset */
  private localTransform: AmmoTransform | null = null;

  /** Temp quaternion for physics */
  private quat: AmmoQuaternion | null = null;

  /** Ghost object for collision */
  private ghostObj: AmmoGhostObject | null = null;

  /** Player physics reference */
  private playerPhysics: PlayerPhysicsComponent | null = null;

  /** Whether player is overlapping */
  public overlapping: boolean = false;

  // ============================================================================
  // CONSTRUCTOR
  // ============================================================================

  constructor(physicsWorld: unknown) {
    super();
    this.physicsWorld = physicsWorld;
  }

  // ============================================================================
  // SETUP
  // ============================================================================

  private setupTrigger(): void {
    const shape = new Ammo.btSphereShape(0.4);
    this.ghostObj = AmmoHelper.CreateTrigger(shape) as AmmoGhostObject;

    const world = this.physicsWorld as {
      addCollisionObject(obj: unknown, group: number): void;
    };
    world.addCollisionObject(this.ghostObj, CollisionFilterGroups.SensorTrigger);
  }

  // ============================================================================
  // INITIALIZATION
  // ============================================================================

  override Initialize(): void {
    // Create local transform
    this.localTransform = new Ammo.btTransform();
    (this.localTransform as unknown as { setIdentity(): void }).setIdentity();
    this.localTransform.getOrigin().setValue(0.0, 1.0, 1.0);

    this.quat = new Ammo.btQuaternion();

    // Get player physics
    const player = this.FindEntity('Player');
    this.playerPhysics = player?.GetComponent('PlayerPhysics') as PlayerPhysicsComponent | undefined ?? null;

    // Setup trigger
    this.setupTrigger();
  }

  // ============================================================================
  // PHYSICS UPDATE
  // ============================================================================

  /**
   * Called during physics step.
   */
  PhysicsUpdate(_world: unknown, _t: number): void {
    if (!this.ghostObj || !this.playerPhysics) return;

    this.overlapping = AmmoHelper.IsTriggerOverlapping(this.ghostObj, this.playerPhysics.body);
  }

  // ============================================================================
  // UPDATE
  // ============================================================================

  override Update(_deltaTime: number): void {
    if (!this.ghostObj || !this.quat || !this.localTransform) return;

    const entityPos = this.parent!.position;
    const entityRot = this.parent!.rotation;
    const transform = this.ghostObj.getWorldTransform();

    this.quat.setValue(entityRot.x, entityRot.y, entityRot.z, entityRot.w);
    transform.setRotation(this.quat);
    transform.getOrigin().setValue(entityPos.x, entityPos.y, entityPos.z);
    transform.op_mul(this.localTransform);
  }
}
