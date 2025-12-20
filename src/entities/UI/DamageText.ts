/**
 * Damage Text Component
 *
 * Floating damage numbers that appear when entities take damage.
 * Floats upward and fades out over time.
 * Self-animates using requestAnimationFrame (no entity update needed).
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
  private startTime: number = 0;
  private mesh: THREE.Sprite | null = null;
  private animationId: number = 0;
  private destroyed: boolean = false;

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

    // Start self-animation
    this.startTime = performance.now();
    this.animate();
  }

  // ============================================================================
  // SELF-ANIMATION (doesn't rely on entity Update)
  // ============================================================================

  private animate = (): void => {
    if (this.destroyed || !this.mesh) return;

    const elapsed = (performance.now() - this.startTime) / 1000;

    if (elapsed >= this.lifeTime) {
      this.destroy();
      return;
    }

    // Float up (1.5 units per second)
    this.mesh.position.y = this.position.y + 1.0 + elapsed * 1.5;

    // Fade out after 0.5s
    if (elapsed > 0.5) {
      this.mesh.material.opacity = 1 - (elapsed - 0.5) / 0.5;
    }

    this.animationId = requestAnimationFrame(this.animate);
  };

  // ============================================================================
  // UPDATE (kept for compatibility but not needed)
  // ============================================================================

  override Update(_deltaTime: number): void {
    // Self-animates via requestAnimationFrame
  }

  // ============================================================================
  // DESTROY
  // ============================================================================

  private destroy(): void {
    if (this.destroyed) return;
    this.destroyed = true;

    // Cancel animation
    if (this.animationId) {
      cancelAnimationFrame(this.animationId);
    }

    if (this.mesh) {
      this.scene.remove(this.mesh);

      if (this.mesh.material.map) {
        this.mesh.material.map.dispose();
      }
      this.mesh.material.dispose();
      this.mesh = null;
    }
  }

  // ============================================================================
  // CLEANUP
  // ============================================================================

  override Cleanup(): void {
    this.destroy();
  }
}
