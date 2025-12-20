/**
 * Player Physics Component
 *
 * Handles player physics body creation and ground detection for jumping.
 */

import Component from '../../core/Component';
import { Ammo } from '../../core/AmmoLib';

// ============================================================================
// CONSTANTS
// ============================================================================

/** Bullet physics constant - disable deactivation */
const DISABLE_DEACTIVATION = 4;

// ============================================================================
// TYPES
// ============================================================================

/** Ammo.js physics world interface */
interface AmmoWorld {
  addRigidBody(body: AmmoRigidBody): void;
  getDispatcher(): AmmoDispatcher;
}

/** Ammo.js rigid body interface */
interface AmmoRigidBody {
  setFriction(friction: number): void;
  setActivationState(state: number): void;
}

/** Ammo.js dispatcher interface */
interface AmmoDispatcher {
  getNumManifolds(): number;
  getManifoldByIndexInternal(index: number): AmmoContactManifold;
}

/** Ammo.js contact manifold interface */
interface AmmoContactManifold {
  getBody0(): unknown;
  getBody1(): unknown;
  getNumContacts(): number;
  getContactPoint(index: number): AmmoContactPoint;
}

/** Ammo.js contact point interface */
interface AmmoContactPoint {
  get_m_normalWorldOnB(): AmmoVector3;
}

/** Ammo.js vector3 interface */
interface AmmoVector3 {
  x(): number;
  y(): number;
  z(): number;
  setValue(x: number, y: number, z: number): void;
  dot(other: AmmoVector3): number;
}

// ============================================================================
// PLAYER PHYSICS COMPONENT
// ============================================================================

export default class PlayerPhysics extends Component {
  override name = 'PlayerPhysics';

  // ============================================================================
  // PHYSICS STATE
  // ============================================================================

  /** Physics world reference */
  private readonly world: AmmoWorld;

  /** Player rigid body */
  public body: AmmoRigidBody | null = null;

  /** Whether the player can jump (grounded) */
  public canJump: boolean = false;

  // ============================================================================
  // TEMP OBJECTS
  // ============================================================================

  private up: AmmoVector3 | null = null;
  private tempVec: AmmoVector3 | null = null;

  // ============================================================================
  // CONSTRUCTOR
  // ============================================================================

  constructor(world: AmmoWorld) {
    super();
    this.world = world;
  }

  // ============================================================================
  // INITIALIZATION
  // ============================================================================

  override Initialize(): void {
    // Create temp vectors
    this.up = new Ammo.btVector3(0, 1, 0);
    this.tempVec = new Ammo.btVector3(0, 0, 0);

    // Physics body parameters
    const height = 1.3;
    const radius = 0.3;
    const mass = 5;

    // Create transform
    const transform = new Ammo.btTransform();
    transform.setIdentity();

    const pos = this.parent!.Position;
    transform.setOrigin(new Ammo.btVector3(pos.x, pos.y, pos.z));

    const motionState = new Ammo.btDefaultMotionState(transform);

    // Create capsule shape
    const shape = new Ammo.btCapsuleShape(radius, height);
    const localInertia = new Ammo.btVector3(0, 0, 0);

    // Create rigid body
    const bodyInfo = new Ammo.btRigidBodyConstructionInfo(mass, motionState, shape, localInertia);
    this.body = new Ammo.btRigidBody(bodyInfo);

    // Configure body
    this.body.setFriction(0);
    this.body.setActivationState(DISABLE_DEACTIVATION);

    // Add to world
    this.world.addRigidBody(this.body);
  }

  // ============================================================================
  // GROUND DETECTION
  // ============================================================================

  private queryJump(): void {
    if (!this.up || !this.tempVec) return;

    const dispatcher = this.world.getDispatcher();
    const numManifolds = dispatcher.getNumManifolds();

    for (let i = 0; i < numManifolds; i++) {
      const contactManifold = dispatcher.getManifoldByIndexInternal(i);

      const rb0 = Ammo.castObject(contactManifold.getBody0(), Ammo.btRigidBody);
      const rb1 = Ammo.castObject(contactManifold.getBody1(), Ammo.btRigidBody);

      // Skip if this body is not involved
      if (rb0 !== this.body && rb1 !== this.body) {
        continue;
      }

      const numContacts = contactManifold.getNumContacts();

      for (let j = 0; j < numContacts; j++) {
        const contactPoint = contactManifold.getContactPoint(j);
        const normal = contactPoint.get_m_normalWorldOnB();

        this.tempVec.setValue(normal.x(), normal.y(), normal.z());

        // Flip normal if we're body 1
        if (rb1 === this.body) {
          this.tempVec.setValue(
            -this.tempVec.x(),
            -this.tempVec.y(),
            -this.tempVec.z()
          );
        }

        // Check if normal is pointing upward (ground-ish)
        const angle = this.tempVec.dot(this.up);
        this.canJump = angle > 0.5;

        if (this.canJump) {
          return;
        }
      }
    }
  }

  // ============================================================================
  // PHYSICS UPDATE
  // ============================================================================

  /**
   * Called during physics step.
   */
  PhysicsUpdate(): void {
    this.queryJump();
  }
}
