import * as THREE from 'three';
import { Component } from '../../core/Component';
import { WEAPONS } from '../../config/weapons.config';
import type { Entity } from '../../core/Entity';

interface WeaponAssets {
  pistol?: THREE.Object3D;
  smg?: THREE.Object3D;
  assaultRifle?: THREE.Object3D;
  smg2?: THREE.Object3D;
  [key: string]: THREE.Object3D | undefined;
}

export default class WeaponPickup extends Component {
  public readonly name = 'WeaponPickup';

  private scene: THREE.Scene;
  private weaponKey: string;
  private weaponAssets: WeaponAssets | null;
  private spawnPosition: THREE.Vector3;
  private pickupRadius = 2.0;
  private collected = false;
  private bobTime: number;
  private bobSpeed = 2.0;
  private bobHeight = 0.3;
  private rotateSpeed = 1.5;
  private baseHeight = 1.2;

  private container: THREE.Group | null = null;
  private sphere: THREE.Mesh | null = null;
  private glow: THREE.Mesh | null = null;
  private weaponMesh: THREE.Object3D | null = null;
  private label: THREE.Sprite | null = null;
  private player: Entity | null = null;

  constructor(
    scene: THREE.Scene,
    weaponKey: string,
    position: THREE.Vector3,
    weaponAssets: WeaponAssets | null = null
  ) {
    super();
    this.scene = scene;
    this.weaponKey = weaponKey;
    this.weaponAssets = weaponAssets;
    this.spawnPosition = position.clone();
    this.bobTime = Math.random() * Math.PI * 2;
  }

  Initialize(): void {
    this.player = this.FindEntity('Player');
    this.CreateVisual();
  }

  CreateVisual(): void {
    const config = WEAPONS[this.weaponKey];
    const color = config?.glowColor || 0x44ff44;

    // Create container group
    this.container = new THREE.Group();
    this.container.position.copy(this.spawnPosition);
    this.container.position.y = this.baseHeight;
    this.scene.add(this.container);

    // Create transparent sphere (the "ball")
    const sphereRadius = 0.5;
    const sphereGeo = new THREE.SphereGeometry(sphereRadius, 24, 24);
    const sphereMat = new THREE.MeshPhysicalMaterial({
      color: color,
      transparent: true,
      opacity: 0.25,
      roughness: 0.1,
      metalness: 0.0,
      clearcoat: 1.0,
      clearcoatRoughness: 0.1,
      side: THREE.DoubleSide,
    });
    this.sphere = new THREE.Mesh(sphereGeo, sphereMat);
    this.container.add(this.sphere);

    // Add glow effect around sphere
    const glowGeo = new THREE.SphereGeometry(sphereRadius * 1.1, 16, 16);
    const glowMat = new THREE.MeshBasicMaterial({
      color: color,
      transparent: true,
      opacity: 0.15,
      side: THREE.BackSide,
    });
    this.glow = new THREE.Mesh(glowGeo, glowMat);
    this.container.add(this.glow);

    // Create weapon model inside the sphere
    this.CreateWeaponModel(config, sphereRadius * 0.7);

    // Add floating text label above
    this.CreateLabel(config?.name || this.weaponKey, color);
  }

  CreateWeaponModel(config: any, maxSize: number): void {
    const modelKey = config?.modelKey;

    // Try to get actual weapon model from assets
    if (this.weaponAssets && modelKey && this.weaponAssets[modelKey]) {
      const sourceModel = this.weaponAssets[modelKey]!;
      this.weaponMesh = sourceModel.clone();

      // Scale to fit inside sphere
      const scale = config?.pickupScale || 0.05;
      this.weaponMesh.scale.set(scale, scale, scale);

      // Center the weapon
      this.weaponMesh.position.set(0, 0, 0);

      // Apply shadows
      this.weaponMesh.traverse((child) => {
        if ((child as THREE.Mesh).isMesh) {
          child.castShadow = true;
        }
      });

      this.container!.add(this.weaponMesh);
    } else {
      // Fallback: Create simple colored box if no asset available
      const boxSize = maxSize * 0.6;
      const boxGeo = new THREE.BoxGeometry(boxSize * 1.5, boxSize * 0.5, boxSize * 0.3);
      const boxMat = new THREE.MeshStandardMaterial({
        color: config?.glowColor || 0x888888,
        emissive: config?.glowColor || 0x888888,
        emissiveIntensity: 0.3,
        metalness: 0.8,
        roughness: 0.3,
      });
      this.weaponMesh = new THREE.Mesh(boxGeo, boxMat);
      this.container!.add(this.weaponMesh);
    }
  }

  CreateLabel(text: string, color: number): void {
    // Create canvas for text
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 64;
    const ctx = canvas.getContext('2d')!;

    ctx.fillStyle = 'transparent';
    ctx.fillRect(0, 0, 256, 64);

    ctx.font = 'bold 28px Arial';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    // Text outline
    ctx.strokeStyle = 'black';
    ctx.lineWidth = 4;
    ctx.strokeText(text, 128, 32);

    // Text fill - convert hex color to CSS
    const hexColor = '#' + color.toString(16).padStart(6, '0');
    ctx.fillStyle = hexColor;
    ctx.fillText(text, 128, 32);

    const texture = new THREE.CanvasTexture(canvas);
    const spriteMat = new THREE.SpriteMaterial({
      map: texture,
      transparent: true,
    });
    this.label = new THREE.Sprite(spriteMat);
    this.label.scale.set(1.5, 0.4, 1);
    this.label.position.y = 0.9;
    this.container!.add(this.label);
  }

  CheckPlayerDistance(): void {
    if (!this.player || this.collected) return;

    const playerPos = this.player.Position;
    const pickupPos = this.container!.position;

    const dx = playerPos.x - pickupPos.x;
    const dz = playerPos.z - pickupPos.z;
    const distSq = dx * dx + dz * dz;

    if (distSq < this.pickupRadius * this.pickupRadius) {
      this.OnCollected();
    }
  }

  OnCollected(): void {
    if (this.collected) return;
    this.collected = true;

    // Notify player's weapon to switch
    if (this.player) {
      this.player.Broadcast({
        topic: 'weapon_pickup',
        weaponKey: this.weaponKey,
      });
    }

    // Play pickup effect (quick scale up then remove)
    this.PlayPickupEffect();
  }

  PlayPickupEffect(): void {
    // Quick flash effect
    if (this.container) {
      this.container.scale.set(1.5, 1.5, 1.5);
      setTimeout(() => {
        this.Cleanup();
      }, 100);
    }
  }

  Cleanup(): void {
    if (this.container) {
      this.scene.remove(this.container);

      // Dispose sphere
      if (this.sphere) {
        this.sphere.geometry.dispose();
        (this.sphere.material as THREE.Material).dispose();
      }

      // Dispose glow
      if (this.glow) {
        this.glow.geometry.dispose();
        (this.glow.material as THREE.Material).dispose();
      }

      // Dispose weapon mesh
      if (this.weaponMesh) {
        this.weaponMesh.traverse((child) => {
          if ((child as THREE.Mesh).isMesh) {
            const mesh = child as THREE.Mesh;
            mesh.geometry?.dispose();
            if (mesh.material) {
              if (Array.isArray(mesh.material)) {
                mesh.material.forEach((m) => m.dispose());
              } else {
                mesh.material.dispose();
              }
            }
          }
        });
      }

      // Dispose label
      if (this.label) {
        this.label.material.map?.dispose();
        this.label.material.dispose();
      }

      this.container = null;
    }
    this.collected = true;
  }

  Update(t: number): void {
    if (this.collected || !this.container) return;

    // Bob up and down
    this.bobTime += t * this.bobSpeed;
    this.container.position.y = this.baseHeight + Math.sin(this.bobTime) * this.bobHeight;

    // Rotate the weapon model inside the sphere (not the whole container)
    if (this.weaponMesh) {
      this.weaponMesh.rotation.y += t * this.rotateSpeed;
    }

    // Pulse the glow
    if (this.glow) {
      const pulse = 1.0 + Math.sin(this.bobTime * 2) * 0.1;
      this.glow.scale.set(pulse, pulse, pulse);
    }

    // Check for player pickup
    this.CheckPlayerDistance();
  }
}
