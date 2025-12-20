/**
 * Navmesh Component
 *
 * Wrapper around three-pathfinding library for navigation queries.
 */

import * as THREE from 'three';
import Component from '../../core/Component';
import { Pathfinding } from 'three-pathfinding';

// ============================================================================
// NAVMESH COMPONENT
// ============================================================================

export default class Navmesh extends Component {
  override name = 'Navmesh';

  // ============================================================================
  // DEPENDENCIES
  // ============================================================================

  private readonly scene: THREE.Scene;
  private readonly mesh: THREE.Object3D;

  // ============================================================================
  // STATE
  // ============================================================================

  private readonly zone: string = 'level1';
  private pathfinding: Pathfinding | null = null;

  // ============================================================================
  // CONSTRUCTOR
  // ============================================================================

  constructor(scene: THREE.Scene, mesh: THREE.Object3D) {
    super();
    this.scene = scene;
    this.mesh = mesh;
  }

  // ============================================================================
  // INITIALIZATION
  // ============================================================================

  override Initialize(): void {
    this.pathfinding = new Pathfinding();

    this.mesh.traverse((node) => {
      if ((node as THREE.Mesh).isMesh) {
        const mesh = node as THREE.Mesh;
        const zoneData = Pathfinding.createZone(mesh.geometry);
        this.pathfinding!.setZoneData(this.zone, zoneData);
      }
    });
  }

  // ============================================================================
  // NAVIGATION QUERIES
  // ============================================================================

  /**
   * Get a random walkable node within range of a position.
   */
  GetRandomNode(position: THREE.Vector3, range: number): THREE.Vector3 | null {
    if (!this.pathfinding) return null;

    try {
      const groupID = this.pathfinding.getGroup(this.zone, position);
      return this.pathfinding.getRandomNode(this.zone, groupID, position, range);
    } catch (e) {
      console.warn('Navmesh.GetRandomNode error:', e);
      return null;
    }
  }

  /**
   * Find a path between two positions.
   */
  FindPath(a: THREE.Vector3, b: THREE.Vector3): THREE.Vector3[] | null {
    if (!this.pathfinding) return null;

    try {
      const groupID = this.pathfinding.getGroup(this.zone, a);
      return this.pathfinding.findPath(a, b, this.zone, groupID);
    } catch (e) {
      console.warn('Navmesh.FindPath error:', e);
      return null;
    }
  }
}
