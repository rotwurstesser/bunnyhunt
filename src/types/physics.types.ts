/**
 * Physics System Type Definitions
 *
 * Type augmentations for Ammo.js (Bullet Physics).
 * Ammo.js has minimal TypeScript support, so we define our own types.
 */

/**
 * Ammo.js module interface.
 * This is a subset of the full Ammo API - add more as needed.
 */
export interface AmmoModule {
  // Vector types
  btVector3: new (x: number, y: number, z: number) => AmmoVector3;
  btQuaternion: new (x: number, y: number, z: number, w: number) => AmmoQuaternion;
  btTransform: new () => AmmoTransform;

  // Collision shapes
  btSphereShape: new (radius: number) => AmmoCollisionShape;
  btBoxShape: new (halfExtents: AmmoVector3) => AmmoCollisionShape;
  btCapsuleShape: new (radius: number, height: number) => AmmoCollisionShape;
  btConvexHullShape: new () => AmmoConvexHullShape;

  // Collision configuration
  btDefaultCollisionConfiguration: new () => unknown;
  btCollisionDispatcher: new (config: unknown) => unknown;
  btDbvtBroadphase: new () => unknown;
  btSequentialImpulseConstraintSolver: new () => unknown;

  // World
  btDiscreteDynamicsWorld: new (
    dispatcher: unknown,
    broadphase: unknown,
    solver: unknown,
    config: unknown
  ) => AmmoPhysicsWorld;

  // Bodies
  btRigidBodyConstructionInfo: new (
    mass: number,
    motionState: unknown,
    shape: AmmoCollisionShape,
    localInertia: AmmoVector3
  ) => unknown;
  btRigidBody: new (info: unknown) => AmmoRigidBody;
  btDefaultMotionState: new (transform: AmmoTransform) => unknown;
  btGhostObject: new () => AmmoGhostObject;
  btPairCachingGhostObject: new () => AmmoGhostObject;

  // Raycast
  ClosestRayResultCallback: new (
    from: AmmoVector3,
    to: AmmoVector3
  ) => AmmoRayResultCallback;

  // Destruction helper
  destroy(obj: unknown): void;
}

export interface AmmoVector3 {
  x(): number;
  y(): number;
  z(): number;
  setValue(x: number, y: number, z: number): void;
  normalize(): void;
  length(): number;
  dot(v: AmmoVector3): number;
  op_add(v: AmmoVector3): AmmoVector3;
  op_sub(v: AmmoVector3): AmmoVector3;
  op_mul(s: number): AmmoVector3;
}

export interface AmmoQuaternion {
  x(): number;
  y(): number;
  z(): number;
  w(): number;
  setValue(x: number, y: number, z: number, w: number): void;
}

export interface AmmoTransform {
  setIdentity(): void;
  setOrigin(origin: AmmoVector3): void;
  getOrigin(): AmmoVector3;
  setRotation(rotation: AmmoQuaternion): void;
  getRotation(): AmmoQuaternion;
}

export interface AmmoCollisionShape {
  setMargin(margin: number): void;
  calculateLocalInertia(mass: number, inertia: AmmoVector3): void;
}

export interface AmmoConvexHullShape extends AmmoCollisionShape {
  addPoint(point: AmmoVector3, recalculateLocalAABB?: boolean): void;
}

export interface AmmoPhysicsWorld {
  setGravity(gravity: AmmoVector3): void;
  addRigidBody(body: AmmoRigidBody, group?: number, mask?: number): void;
  removeRigidBody(body: AmmoRigidBody): void;
  addCollisionObject(obj: unknown, group?: number, mask?: number): void;
  removeCollisionObject(obj: unknown): void;
  stepSimulation(timeStep: number, maxSubSteps?: number, fixedTimeStep?: number): void;
  rayTest(from: AmmoVector3, to: AmmoVector3, callback: AmmoRayResultCallback): void;
  getDispatcher(): AmmoDispatcher;
  getPairCache(): unknown;
}

export interface AmmoDispatcher {
  getNumManifolds(): number;
  getManifoldByIndexInternal(index: number): AmmoContactManifold;
}

export interface AmmoContactManifold {
  getBody0(): AmmoRigidBody;
  getBody1(): AmmoRigidBody;
  getNumContacts(): number;
}

export interface AmmoRigidBody {
  setLinearVelocity(velocity: AmmoVector3): void;
  getLinearVelocity(): AmmoVector3;
  setAngularVelocity(velocity: AmmoVector3): void;
  getAngularVelocity(): AmmoVector3;
  getWorldTransform(): AmmoTransform;
  setWorldTransform(transform: AmmoTransform): void;
  activate(forceActivation?: boolean): void;
  setActivationState(state: number): void;
  getUserPointer(): number;
  setUserPointer(ptr: number): void;
  getUserIndex(): number;
  setUserIndex(index: number): void;
  setCcdMotionThreshold(threshold: number): void;
  setCcdSweptSphereRadius(radius: number): void;
  setFriction(friction: number): void;
  setRestitution(restitution: number): void;
  setDamping(linear: number, angular: number): void;
  applyCentralImpulse(impulse: AmmoVector3): void;
  applyImpulse(impulse: AmmoVector3, relPos: AmmoVector3): void;
  getMotionState(): { getWorldTransform(transform: AmmoTransform): void };
}

export interface AmmoGhostObject {
  setWorldTransform(transform: AmmoTransform): void;
  getWorldTransform(): AmmoTransform;
  setCollisionShape(shape: AmmoCollisionShape): void;
  setCollisionFlags(flags: number): void;
  getNumOverlappingObjects(): number;
  getOverlappingObject(index: number): AmmoRigidBody;
}

export interface AmmoRayResultCallback {
  hasHit(): boolean;
  get_m_collisionObject(): unknown;
  get_m_hitPointWorld(): AmmoVector3;
  get_m_hitNormalWorld(): AmmoVector3;
  get_m_closestHitFraction(): number;
}

/**
 * Collision filter groups used for physics layers.
 */
export enum CollisionFilterGroups {
  DefaultFilter = 1,
  StaticFilter = 2,
  KinematicFilter = 4,
  DebrisFilter = 8,
  SensorTrigger = 16,
  CharacterFilter = 32,
  AllFilter = -1,
}

/**
 * Activation states for rigid bodies.
 */
export enum ActivationState {
  ACTIVE_TAG = 1,
  ISLAND_SLEEPING = 2,
  WANTS_DEACTIVATION = 3,
  DISABLE_DEACTIVATION = 4,
  DISABLE_SIMULATION = 5,
}
