import * as AmmoModule from "ammo.js"
import * as THREE from 'three'
import { ConvexHull } from 'three/examples/jsm/math/ConvexHull'

// ammo.js 0.0.10 exports the library directly (not as factory)
let Ammo = AmmoModule.default || AmmoModule;

const CollisionFlags = { CF_NO_CONTACT_RESPONSE: 4 }
const CollisionFilterGroups = {
  DefaultFilter: 1,
  StaticFilter: 2,
  KinematicFilter: 4,
  DebrisFilter: 8,
  SensorTrigger: 16,
  CharacterFilter: 32,
  AllFilter: -1 //all bits sets: DefaultFilter | StaticFilter | KinematicFilter | DebrisFilter | SensorTrigger
};

// Global registry to map Ammo collision object pointers to entities
// This is necessary because Ammo.castObject creates new JS wrappers that don't preserve custom properties
const collisionObjectRegistry = new Map();

function createConvexHullShape(object) {
  const geometry = createConvexGeom(object);
  let coords = geometry.attributes.position.array;
  let tempVec = new Ammo.btVector3(0, 0, 0);
  let shape = new Ammo.btConvexHullShape();
  for (let i = 0, il = coords.length; i < il; i += 3) {
    tempVec.setValue(coords[i], coords[i + 1], coords[i + 2]);
    let lastOne = (i >= (il - 3));
    shape.addPoint(tempVec, lastOne);
  }
  return shape;
}

function createConvexGeom(object) {
  // Compute the 3D convex hull.
  let hull = new ConvexHull().setFromObject(object);
  let faces = hull.faces;
  let vertices = [];
  let normals = [];

  for (var i = 0; i < faces.length; i++) {
    var face = faces[i];
    var edge = face.edge;
    do {
      var point = edge.head().point;
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

class AmmoHelper {

  static Init(callback = () => { }) {
    // ammo.js 0.0.10 is already loaded, no factory pattern needed
    callback();
  }

  // Register an entity with its collision object for later lookup
  static RegisterCollisionEntity(collisionObject, entity) {
    const ptr = Ammo.getPointer(collisionObject);
    collisionObjectRegistry.set(ptr, entity);
  }

  // Unregister an entity when its collision object is removed
  static UnregisterCollisionEntity(collisionObject) {
    const ptr = Ammo.getPointer(collisionObject);
    collisionObjectRegistry.delete(ptr);
  }

  // Look up an entity by its collision object
  static GetEntityFromCollisionObject(collisionObject) {
    const ptr = Ammo.getPointer(collisionObject);
    return collisionObjectRegistry.get(ptr);
  }

  static CreateTrigger(shape, position, rotation) {
    const transform = new Ammo.btTransform();
    transform.setIdentity();
    position && transform.setOrigin(new Ammo.btVector3(position.x, position.y, position.z));
    rotation && transform.setRotation(new Ammo.btQuaternion(rotation.x, rotation.y, rotation.z, rotation.w));

    const ghostObj = new Ammo.btPairCachingGhostObject();
    ghostObj.setCollisionShape(shape);
    ghostObj.setCollisionFlags(CollisionFlags.CF_NO_CONTACT_RESPONSE);
    ghostObj.setWorldTransform(transform);

    return ghostObj;
  }

  static IsTriggerOverlapping(ghostObj, rigidBody) {
    for (let i = 0; i < ghostObj.getNumOverlappingObjects(); i++) {
      const body = Ammo.castObject(ghostObj.getOverlappingObject(i), Ammo.btRigidBody);
      if (body == rigidBody) {
        return true;
      }
    }

    return false;
  }

  static CastRay(world, origin, dest, result = {}, collisionFilterMask = CollisionFilterGroups.AllFilter) {
    try {
      // Create fresh callback each time (ammo.js 0.0.10 doesn't support resetting)
      const rayFrom = new Ammo.btVector3(origin.x, origin.y, origin.z);
      const rayTo = new Ammo.btVector3(dest.x, dest.y, dest.z);
      const rayCallback = new Ammo.ClosestRayResultCallback(rayFrom, rayTo);

      // Perform ray test
      world.rayTest(rayFrom, rayTo, rayCallback);

      if (rayCallback.hasHit()) {
        if (result.intersectionPoint) {
          // Handle both getter method and direct property access
          const point = rayCallback.get_m_hitPointWorld ?
            rayCallback.get_m_hitPointWorld() : rayCallback.m_hitPointWorld;
          if (point) {
            result.intersectionPoint.set(point.x(), point.y(), point.z());
          }
        }

        if (result.intersectionNormal) {
          const normal = rayCallback.get_m_hitNormalWorld ?
            rayCallback.get_m_hitNormalWorld() : rayCallback.m_hitNormalWorld;
          if (normal) {
            result.intersectionNormal.set(normal.x(), normal.y(), normal.z());
          }
        }

        result.collisionObject = rayCallback.get_m_collisionObject ?
          rayCallback.get_m_collisionObject() : rayCallback.m_collisionObject;

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

}

export { AmmoHelper, Ammo, createConvexHullShape, CollisionFlags, CollisionFilterGroups }
