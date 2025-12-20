/**
 * Ammo.js Helper Library
 *
 * Provides typed utilities for Ammo.js (Bullet Physics) integration.
 * Handles collision shapes, triggers, raycasting, and entity-collision mapping.
 */

import * as AmmoModule from 'ammo.js';
import * as THREE from 'three';
import { ConvexHull } from 'three/examples/jsm/math/ConvexHull';
import type { IEntity } from '../types/entity.types';
import type { HitResult } from '../types/events.types';

// ammo.js 0.0.10 exports the library directly (not as factory)
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const Ammo: any = (AmmoModule as any).default || AmmoModule;

/**
 * Collision flags for Ammo.js objects.
 */
export const CollisionFlags = {
  CF_NO_CONTACT_RESPONSE: 4,
} as const;

/**
 * Collision filter groups for layer-based collision detection.
 */
export const CollisionFilterGroups = {
  DefaultFilter: 1,
  StaticFilter: 2,
  KinematicFilter: 4,
  DebrisFilter: 8,
  SensorTrigger: 16,
  CharacterFilter: 32,
  AllFilter: -1, // All bits set
} as const;

export type CollisionFilterGroup =
  (typeof CollisionFilterGroups)[keyof typeof CollisionFilterGroups];

/**
 * Global registry to map Ammo collision object pointers to entities.
 * Necessary because Ammo.castObject creates new JS wrappers that don't preserve custom properties.
 */
const collisionObjectRegistry = new Map<number, IEntity>();

/**
 * Creates a convex geometry from a Three.js object using ConvexHull.
 */
function createConvexGeom(object: THREE.Object3D): THREE.BufferGeometry {
  const hull = new ConvexHull().setFromObject(object);
  const faces = hull.faces;
  const vertices: number[] = [];
  const normals: number[] = [];

  for (let i = 0; i < faces.length; i++) {
    const face = faces[i];
    let edge = face.edge;
    do {
      const point = edge.head().point;
      vertices.push(point.x, point.y, point.z);
      normals.push(face.normal.x, face.normal.y, face.normal.z);
      edge = edge.next;
    } while (edge !== face.edge);
  }

  const geom = new THREE.BufferGeometry();
  geom.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
  geom.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));

  return geom;
}

/**
 * Creates a convex hull collision shape from a Three.js object.
 */
export function createConvexHullShape(object: THREE.Object3D): unknown {
  const geometry = createConvexGeom(object);
  const coords = geometry.attributes.position.array;
  const tempVec = new Ammo.btVector3(0, 0, 0);
  const shape = new Ammo.btConvexHullShape();

  for (let i = 0, il = coords.length; i < il; i += 3) {
    tempVec.setValue(coords[i], coords[i + 1], coords[i + 2]);
    const lastOne = i >= il - 3;
    shape.addPoint(tempVec, lastOne);
  }

  return shape;
}

/**
 * Result object for raycast operations.
 */
export interface RaycastResult {
  intersectionPoint?: THREE.Vector3;
  intersectionNormal?: THREE.Vector3;
  collisionObject?: unknown;
}

/**
 * Static helper class for Ammo.js operations.
 */
export class AmmoHelper {
  /**
   * Initialize Ammo.js.
   * In ammo.js 0.0.10, the library is already loaded, no factory pattern needed.
   */
  static Init(callback: () => void = () => {}, _flags?: number): void {
    callback();
  }

  /**
   * Register an entity with its collision object for later lookup.
   */
  static RegisterCollisionEntity(collisionObject: unknown, entity: IEntity): void {
    const ptr = Ammo.getPointer(collisionObject);
    collisionObjectRegistry.set(ptr, entity);
  }

  /**
   * Unregister an entity when its collision object is removed.
   */
  static UnregisterCollisionEntity(collisionObject: unknown): void {
    const ptr = Ammo.getPointer(collisionObject);
    collisionObjectRegistry.delete(ptr);
  }

  /**
   * Look up an entity by its collision object.
   */
  static GetEntityFromCollisionObject(collisionObject: unknown): IEntity | undefined {
    const ptr = Ammo.getPointer(collisionObject);
    return collisionObjectRegistry.get(ptr);
  }

  /**
   * Create a trigger (ghost object) for overlap detection.
   */
  static CreateTrigger(
    shape: unknown,
    position?: THREE.Vector3,
    rotation?: THREE.Quaternion
  ): unknown {
    const transform = new Ammo.btTransform();
    transform.setIdentity();

    if (position) {
      transform.setOrigin(new Ammo.btVector3(position.x, position.y, position.z));
    }

    if (rotation) {
      transform.setRotation(
        new Ammo.btQuaternion(rotation.x, rotation.y, rotation.z, rotation.w)
      );
    }

    const ghostObj = new Ammo.btPairCachingGhostObject();
    ghostObj.setCollisionShape(shape);
    ghostObj.setCollisionFlags(CollisionFlags.CF_NO_CONTACT_RESPONSE);
    ghostObj.setWorldTransform(transform);

    return ghostObj;
  }

  /**
   * Check if a trigger is overlapping with a rigid body.
   */
  static IsTriggerOverlapping(ghostObj: unknown, rigidBody: unknown): boolean {
    const ghost = ghostObj as { getNumOverlappingObjects(): number; getOverlappingObject(i: number): unknown };
    for (let i = 0; i < ghost.getNumOverlappingObjects(); i++) {
      const body = Ammo.castObject(ghost.getOverlappingObject(i), Ammo.btRigidBody);
      if (body === rigidBody) {
        return true;
      }
    }
    return false;
  }

  /**
   * Cast a ray in the physics world.
   *
   * @param world - The physics world
   * @param origin - Ray start point
   * @param dest - Ray end point
   * @param result - Object to store hit results
   * @param collisionFilterMask - Which layers to check
   * @returns true if ray hit something
   */
  static CastRay(
    world: unknown,
    origin: THREE.Vector3,
    dest: THREE.Vector3,
    result: RaycastResult = {},
    _collisionFilterMask: CollisionFilterGroup = CollisionFilterGroups.AllFilter
  ): boolean {
    try {
      // Create fresh callback each time (ammo.js 0.0.10 doesn't support resetting)
      const rayFrom = new Ammo.btVector3(origin.x, origin.y, origin.z);
      const rayTo = new Ammo.btVector3(dest.x, dest.y, dest.z);
      const rayCallback = new Ammo.ClosestRayResultCallback(rayFrom, rayTo);

      // Perform ray test
      (world as { rayTest: (from: unknown, to: unknown, callback: unknown) => void })
        .rayTest(rayFrom, rayTo, rayCallback);

      if (rayCallback.hasHit()) {
        if (result.intersectionPoint) {
          // Handle both getter method and direct property access
          const point = rayCallback.get_m_hitPointWorld
            ? rayCallback.get_m_hitPointWorld()
            : rayCallback.m_hitPointWorld;
          if (point) {
            result.intersectionPoint.set(point.x(), point.y(), point.z());
          }
        }

        if (result.intersectionNormal) {
          const normal = rayCallback.get_m_hitNormalWorld
            ? rayCallback.get_m_hitNormalWorld()
            : rayCallback.m_hitNormalWorld;
          if (normal) {
            result.intersectionNormal.set(normal.x(), normal.y(), normal.z());
          }
        }

        result.collisionObject = rayCallback.get_m_collisionObject
          ? rayCallback.get_m_collisionObject()
          : rayCallback.m_collisionObject;

        // Clean up
        Ammo.destroy(rayFrom);
        Ammo.destroy(rayTo);
        Ammo.destroy(rayCallback);

        return true;
      }

      // Clean up even on miss
      Ammo.destroy(rayFrom);
      Ammo.destroy(rayTo);
      Ammo.destroy(rayCallback);

      return false;
    } catch (e) {
      console.error('CastRay error:', e);
      return false;
    }
  }

  /**
   * Convert raycast result to typed HitResult.
   */
  static ToHitResult(result: RaycastResult): HitResult | null {
    if (!result.collisionObject || !result.intersectionPoint || !result.intersectionNormal) {
      return null;
    }
    return {
      intersectionPoint: result.intersectionPoint.clone(),
      intersectionNormal: result.intersectionNormal.clone(),
      collisionObject: result.collisionObject,
    };
  }
}

// Export Ammo for direct access
export { Ammo };
