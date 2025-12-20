/**
 * Damage Text Component
 *
 * Floating damage numbers that appear when entities take damage.
 * Floats upward and fades out over time.
 */

import * as THREE from 'three';
import Component from '../../core/Component';

// ============================================================================
// DAMAGE TEXT COMPONENT
// ============================================================================

export default class DamageText extends Component {
  override name = 'DamageText';

  // ============================================================================
  // DEPENDENCIES
  // ============================================================================

  private readonly scene: THREE.Scene;

  // ============================================================================
  // STATE
  // ============================================================================

  private readonly position: THREE.Vector3;
  private readonly amount: number;
  private readonly lifeTime: number = 1.0;
  private age: number = 0;
  private mesh: THREE.Sprite | null = null;

  // ============================================================================
  // CONSTRUCTOR
  // ============================================================================

  constructor(position: THREE.Vector3, amount: number, scene: THREE.Scene) {
    super();
    this.scene = scene;
    this.position = position.clone();
    this.amount = Math.round(amount);
  }

  // ============================================================================
  // INITIALIZATION
  // ============================================================================

  override Initialize(): void {
    // Create text sprite
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    canvas.width = 256;
    canvas.height = 128;

    // Text style
    ctx.font = 'Bold 80px Arial';
    ctx.fillStyle = '#ff0000'; // Red text
    ctx.strokeStyle = 'white';
    ctx.lineWidth = 4;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    // Draw text
    const text = `-${this.amount}`;
    ctx.strokeText(text, 128, 64);
    ctx.fillText(text, 128, 64);

    const texture = new THREE.CanvasTexture(canvas);
    const material = new THREE.SpriteMaterial({
      map: texture,
      transparent: true,
      depthTest: false, // Always show on top
      depthWrite: false,
    });

    this.mesh = new THREE.Sprite(material);
    this.mesh.position.copy(this.position);
    this.mesh.position.y += 1.0; // Start slightly above
    this.mesh.scale.set(2, 1, 1); // Scale sprite

    this.scene.add(this.mesh);
  }

  // ============================================================================
  // UPDATE
  // ============================================================================

  override Update(deltaTime: number): void {
    this.age += deltaTime;

    if (this.age >= this.lifeTime) {
      this.destroy();
      return;
    }

    if (!this.mesh) return;

    // Float up
    this.mesh.position.y += 1.5 * deltaTime;

    // Update opacity (fade out after 0.5s)
    if (this.age > 0.5) {
      this.mesh.material.opacity = 1 - (this.age - 0.5) / 0.5;
    }
  }

  // ============================================================================
  // DESTROY
  // ============================================================================

  private destroy(): void {
    if (this.mesh) {
      this.scene.remove(this.mesh);

      if (this.mesh.material.map) {
        this.mesh.material.map.dispose();
      }
      this.mesh.material.dispose();
      this.mesh = null;
    }

    // Mark parent entity as dead for cleanup
    if (this.parent && typeof (this.parent as { SetDead?: () => void }).SetDead === 'function') {
      (this.parent as { SetDead: () => void }).SetDead();
    }
  }

  // ============================================================================
  // CLEANUP
  // ============================================================================

  override Cleanup(): void {
    this.destroy();
  }
}
