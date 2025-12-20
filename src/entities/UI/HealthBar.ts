/**
 * Health Bar Component
 *
 * 3D health bar that floats above entities.
 * Billboards towards camera and changes color based on health.
 */

import * as THREE from 'three';
import Component from '../../core/Component';

// ============================================================================
// TYPES
// ============================================================================

/** Parent params interface */
interface HealthParams {
  health: number;
  maxHealth: number;
  healthBarYOffset?: number;
  healthBarScale?: number;
}

/** Player controls interface for camera access */
interface PlayerControlsComponent {
  camera: THREE.Camera;
}

// ============================================================================
// HEALTH BAR COMPONENT
// ============================================================================

export default class HealthBar extends Component {
  override name = 'HealthBar';

  // ============================================================================
  // DEPENDENCIES
  // ============================================================================

  private readonly scene: THREE.Scene;
  private readonly params: HealthParams;

  // ============================================================================
  // MESHES
  // ============================================================================

  private barMesh: THREE.Mesh | null = null;
  private bgMesh: THREE.Mesh | null = null;

  /** Container group for billboard */
  public container: THREE.Group | null = null;

  // ============================================================================
  // CONFIG
  // ============================================================================

  private readonly width: number = 1.0;
  private readonly height: number = 0.15;

  // ============================================================================
  // CONSTRUCTOR
  // ============================================================================

  constructor(scene: THREE.Scene, parentParams: HealthParams) {
    super();
    this.scene = scene;
    this.params = parentParams;
  }

  // ============================================================================
  // INITIALIZATION
  // ============================================================================

  override Initialize(): void {
    // Create background
    const bgGeo = new THREE.PlaneGeometry(this.width, this.height);
    const bgMat = new THREE.MeshBasicMaterial({ color: 0x000000, side: THREE.DoubleSide });
    this.bgMesh = new THREE.Mesh(bgGeo, bgMat);

    // Create foreground (life bar)
    const fgGeo = new THREE.PlaneGeometry(this.width - 0.05, this.height - 0.05);
    const fgMat = new THREE.MeshBasicMaterial({ color: 0x00ff00, side: THREE.DoubleSide });
    this.barMesh = new THREE.Mesh(fgGeo, fgMat);
    this.barMesh.position.z = 0.01; // Slightly in front

    // Group them
    this.container = new THREE.Group();
    this.container.add(this.bgMesh);
    this.container.add(this.barMesh);

    // Scale the health bar for larger entities
    const scale = this.params.healthBarScale ?? 1.0;
    this.container.scale.setScalar(scale);

    this.scene.add(this.container);
  }

  // ============================================================================
  // UPDATE
  // ============================================================================

  override Update(_deltaTime: number): void {
    if (!this.container || !this.barMesh) return;

    // Billboard: look at camera
    const player = this.FindEntity('Player');
    const playerControls = player?.GetComponent('PlayerControls') as PlayerControlsComponent | undefined;
    const camera = playerControls?.camera;

    if (camera) {
      this.container.lookAt((camera as THREE.PerspectiveCamera).position);
    }

    // Position above parent
    if (this.parent) {
      const pos = this.parent.position.clone();
      pos.y += this.params.healthBarYOffset ?? 1.8;
      this.container.position.copy(pos);
    }

    // Update health scale
    const healthPercent = Math.max(0, this.params.health / this.params.maxHealth);
    this.barMesh.scale.x = healthPercent;

    // Color transition
    const material = this.barMesh.material as THREE.MeshBasicMaterial;
    if (healthPercent > 0.6) {
      material.color.setHex(0x00ff00); // Green
    } else if (healthPercent > 0.3) {
      material.color.setHex(0xffff00); // Yellow
    } else {
      material.color.setHex(0xff0000); // Red
    }

    // Hide if dead
    if (healthPercent <= 0) {
      this.container.visible = false;
    }
  }

  // ============================================================================
  // CLEANUP
  // ============================================================================

  override Cleanup(): void {
    if (this.container && this.scene) {
      this.scene.remove(this.container);

      if (this.bgMesh) {
        this.bgMesh.geometry.dispose();
        (this.bgMesh.material as THREE.Material).dispose();
      }

      if (this.barMesh) {
        this.barMesh.geometry.dispose();
        (this.barMesh.material as THREE.Material).dispose();
      }
    }
  }
}
