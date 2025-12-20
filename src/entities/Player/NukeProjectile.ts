/**
 * Nuke Projectile Component
 *
 * Projectile fired by the nuke weapon.
 * Moves in an arc and creates a large explosion on impact.
 */

import * as THREE from 'three';
import Component from '../../core/Component';

// ============================================================================
// TYPES
// ============================================================================

/** Trail particle data */
interface TrailParticle {
  mesh: THREE.Mesh;
  delay: number;
}

// ============================================================================
// NUKE PROJECTILE COMPONENT
// ============================================================================

export default class NukeProjectile extends Component {
  override name = 'NukeProjectile';

  // ============================================================================
  // DEPENDENCIES
  // ============================================================================

  private readonly scene: THREE.Scene;
  private readonly startPosition: THREE.Vector3;
  private readonly direction: THREE.Vector3;

  // ============================================================================
  // STATE
  // ============================================================================

  /** Current position */
  private position: THREE.Vector3;

  /** Projectile speed */
  private readonly velocity: number = 30.0;

  /** Whether projectile has detonated */
  private hasDetonated: boolean = false;

  /** Time since launch */
  private lifetime: number = 0;

  /** Maximum lifetime before auto-detonation */
  private readonly maxLifetime: number = 10;

  /** Projectile mesh */
  private mesh: THREE.Mesh | null = null;

  /** Point light for glow */
  private light: THREE.PointLight | null = null;

  /** Trail particles */
  private trailParticles: TrailParticle[] = [];

  // ============================================================================
  // CONSTRUCTOR
  // ============================================================================

  constructor(scene: THREE.Scene, startPosition: THREE.Vector3, direction: THREE.Vector3) {
    super();
    this.scene = scene;
    this.startPosition = startPosition.clone();
    this.direction = direction.clone().normalize();
    this.position = startPosition.clone();
  }

  // ============================================================================
  // INITIALIZATION
  // ============================================================================

  override Initialize(): void {
    // Create projectile visual - glowing sphere
    const geometry = new THREE.SphereGeometry(0.3, 16, 16);
    const material = new THREE.MeshBasicMaterial({
      color: 0xff4400,
    });
    this.mesh = new THREE.Mesh(geometry, material);
    this.mesh.position.copy(this.position);
    this.scene.add(this.mesh);

    // Add point light for glow effect
    this.light = new THREE.PointLight(0xff4400, 2, 10);
    this.mesh.add(this.light);

    // Create trail effect
    this.createTrail();
  }

  // ============================================================================
  // TRAIL
  // ============================================================================

  private createTrail(): void {
    const trailGeometry = new THREE.SphereGeometry(0.1, 8, 8);

    for (let i = 0; i < 10; i++) {
      const trailMaterial = new THREE.MeshBasicMaterial({
        color: 0xff6600,
        transparent: true,
        opacity: 0.5,
      });
      const trail = new THREE.Mesh(trailGeometry, trailMaterial);
      trail.position.copy(this.position);
      trail.visible = false;
      this.scene.add(trail);
      this.trailParticles.push({
        mesh: trail,
        delay: i * 0.05,
      });
    }
  }

  private updateTrail(_deltaTime: number): void {
    this.trailParticles.forEach((particle, index) => {
      if (this.lifetime > particle.delay) {
        particle.mesh.visible = true;
        particle.mesh.position.lerp(this.position, 0.1);
        (particle.mesh.material as THREE.MeshBasicMaterial).opacity = Math.max(
          0,
          0.5 - index * 0.05
        );
      }
    });
  }

  // ============================================================================
  // COLLISION
  // ============================================================================

  private checkCollision(): boolean {
    // Simple ground collision check
    if (this.position.y <= 0.5) {
      return true;
    }
    return false;
  }

  // ============================================================================
  // DETONATION
  // ============================================================================

  private detonate(): void {
    if (this.hasDetonated) return;
    this.hasDetonated = true;

    // Create explosion visual
    this.createExplosionEffect();

    // Trigger nuke detonation event
    const spawnManager = this.FindEntity('SpawnManager');
    if (spawnManager) {
      spawnManager.Broadcast({ topic: 'nuke_detonated' });
    }

    // Clean up projectile
    this.cleanup();
  }

  private createExplosionEffect(): void {
    // Create expanding explosion sphere
    const explosionGeometry = new THREE.SphereGeometry(1, 32, 32);
    const explosionMaterial = new THREE.MeshBasicMaterial({
      color: 0xffff00,
      transparent: true,
      opacity: 0.9,
    });
    const explosion = new THREE.Mesh(explosionGeometry, explosionMaterial);
    explosion.position.copy(this.position);
    this.scene.add(explosion);

    // Create shock wave ring
    const ringGeometry = new THREE.RingGeometry(0.5, 1, 32);
    const ringMaterial = new THREE.MeshBasicMaterial({
      color: 0xff8800,
      transparent: true,
      opacity: 0.8,
      side: THREE.DoubleSide,
    });
    const ring = new THREE.Mesh(ringGeometry, ringMaterial);
    ring.position.copy(this.position);
    ring.rotation.x = -Math.PI / 2;
    this.scene.add(ring);

    // Animate explosion
    let scale = 1;
    let ringScale = 1;

    const animateExplosion = (): void => {
      scale += 5;
      ringScale += 8;

      explosion.scale.setScalar(scale);
      explosionMaterial.opacity = Math.max(0, 1 - scale / 50);

      ring.scale.setScalar(ringScale);
      ringMaterial.opacity = Math.max(0, 0.8 - ringScale / 80);

      if (scale < 50) {
        requestAnimationFrame(animateExplosion);
      } else {
        this.scene.remove(explosion);
        this.scene.remove(ring);
        explosion.geometry.dispose();
        explosionMaterial.dispose();
        ring.geometry.dispose();
        ringMaterial.dispose();
      }
    };

    animateExplosion();

    // Screen flash
    this.screenFlash();
  }

  private screenFlash(): void {
    const flash = document.createElement('div');
    flash.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background: radial-gradient(circle, #fff 0%, #ff8800 50%, #ff0000 100%);
      opacity: 1;
      pointer-events: none;
      z-index: 9999;
      transition: opacity 1s ease-out;
    `;
    document.body.appendChild(flash);

    setTimeout(() => {
      flash.style.opacity = '0';
      setTimeout(() => flash.remove(), 1000);
    }, 200);
  }

  // ============================================================================
  // CLEANUP
  // ============================================================================

  private cleanup(): void {
    // Remove mesh
    if (this.mesh) {
      this.scene.remove(this.mesh);
      this.mesh.geometry.dispose();
      (this.mesh.material as THREE.Material).dispose();
    }

    // Remove trail
    this.trailParticles.forEach((particle) => {
      this.scene.remove(particle.mesh);
      particle.mesh.geometry.dispose();
      (particle.mesh.material as THREE.Material).dispose();
    });

    // Remove entity from manager after a frame
    setTimeout(() => {
      const entityManager = this.parent?.parent;
      if (entityManager && typeof (entityManager as { Remove?: (e: unknown) => void }).Remove === 'function') {
        (entityManager as { Remove: (e: unknown) => void }).Remove(this.parent);
      }
    }, 100);
  }

  override Cleanup(): void {
    this.cleanup();
  }

  // ============================================================================
  // UPDATE
  // ============================================================================

  override Update(deltaTime: number): void {
    if (this.hasDetonated) return;

    this.lifetime += deltaTime;

    // Move projectile
    const movement = this.direction.clone().multiplyScalar(this.velocity * deltaTime);
    this.position.add(movement);

    // Apply gravity (slight arc)
    this.direction.y -= 0.3 * deltaTime;

    // Update mesh position
    if (this.mesh) {
      this.mesh.position.copy(this.position);
      // Spin the projectile
      this.mesh.rotation.x += deltaTime * 5;
      this.mesh.rotation.z += deltaTime * 3;
    }

    // Update trail
    this.updateTrail(deltaTime);

    // Check for collision or max lifetime
    if (this.checkCollision() || this.lifetime >= this.maxLifetime) {
      this.detonate();
    }
  }
}
