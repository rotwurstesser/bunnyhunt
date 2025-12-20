import * as THREE from 'three';
import { Component } from '../../core/Component';

/**
 * Simplified navmesh for infinite flat terrain.
 * Since terrain is flat and infinite, we use direct navigation.
 */
export default class ForestNavmesh extends Component {
  public readonly name = 'Navmesh';

  constructor() {
    super();
  }

  Initialize(): void {
    // No complex navmesh needed for flat infinite terrain
  }

  /**
   * Get a random navigation point within range of given position.
   */
  GetRandomNode(position: THREE.Vector3, range: number): THREE.Vector3 {
    // Generate random angle and distance
    const angle = Math.random() * Math.PI * 2;
    const distance = Math.random() * range;

    const x = position.x + Math.cos(angle) * distance;
    const z = position.z + Math.sin(angle) * distance;

    return new THREE.Vector3(x, 0, z);
  }

  /**
   * Find path from start to end.
   * For flat terrain, direct path works fine.
   */
  FindPath(start: THREE.Vector3, end: THREE.Vector3): THREE.Vector3[] {
    // For flat terrain, just return direct path to target
    return [new THREE.Vector3(end.x, 0, end.z)];
  }
}
