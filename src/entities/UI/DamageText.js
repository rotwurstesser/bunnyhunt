import * as THREE from 'three';
import Component from '../../Component';

export class DamageText extends Component {
  constructor(position, amount, scene) {
    super();
    this.name = 'DamageText';
    this.scene = scene;
    this.position = position.clone();
    this.amount = Math.round(amount);
    this.lifeTime = 1.0; // Seconds to live
    this.age = 0;
    this.mesh = null;
  }

  Initialize() {
    // Create text sprite
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
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
      depthWrite: false
    });

    this.mesh = new THREE.Sprite(material);
    this.mesh.position.copy(this.position);
    this.mesh.position.y += 1.0; // Start slightly above
    this.mesh.scale.set(2, 1, 1); // Scale sprite

    this.scene.add(this.mesh);
  }

  Update(t) {
    this.age += t;

    if (this.age >= this.lifeTime) {
      this.Destroy();
      return;
    }

    // Float up
    this.mesh.position.y += 1.5 * t;

    // Updates opacity
    if (this.age > 0.5) {
      this.mesh.material.opacity = 1 - ((this.age - 0.5) / 0.5);
    }
  }

  Destroy() {
    if (this.mesh) {
      this.scene.remove(this.mesh);
      this.mesh.material.map.dispose();
      this.mesh.material.dispose();
      this.mesh = null;
    }

    // Remove self from parent (usually EntityManager handles this via flag,
    // but here we might need to be explicit or rely on component system cleanup)
    // Assuming EntityManager cleans upcomponents if parent is removed?
    // Actually, DamageText is usually an Entity itself or attached to a dummy.
    // In this codebase using Component system:
    if (this.parent && this.parent.SetDead) {
      this.parent.SetDead();
    }
  }
}
