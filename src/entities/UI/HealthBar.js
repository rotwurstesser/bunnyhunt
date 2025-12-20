import * as THREE from 'three';
import Component from '../../Component';

export default class HealthBar extends Component {
  constructor(scene, parentParams) {
    super();
    this.name = 'HealthBar';
    this.scene = scene;
    this.params = parentParams;
    this.barMesh = null;
    this.bgMesh = null;
    this.width = 1.0;
    this.height = 0.15;
  }

  Initialize() {
    // Create Background
    const bgGeo = new THREE.PlaneGeometry(this.width, this.height);
    const bgMat = new THREE.MeshBasicMaterial({ color: 0x000000, side: THREE.DoubleSide });
    this.bgMesh = new THREE.Mesh(bgGeo, bgMat);

    // Create Foreground (Life)
    const fgGeo = new THREE.PlaneGeometry(this.width - 0.05, this.height - 0.05);
    const fgMat = new THREE.MeshBasicMaterial({ color: 0x00ff00, side: THREE.DoubleSide });
    this.barMesh = new THREE.Mesh(fgGeo, fgMat);
    this.barMesh.position.z = 0.01; // Slightly in front

    // Add to scene but group them
    this.container = new THREE.Group();
    this.container.add(this.bgMesh);
    this.container.add(this.barMesh);
    this.scene.add(this.container);
  }

  Update(time) {
    if (!this.container) return;

    // Billboard logic: look at camera
    const camera = this.FindEntity('Player')?.GetComponent('PlayerControls')?.camera;
    if (camera) {
      this.container.lookAt(camera.position);
    }

    // Position above parent
    if (this.parent) {
      const pos = this.parent.position.clone();
      pos.y += 1.8; // Height above unit
      this.container.position.copy(pos);
    }

    // Update Health Scale
    const healthPercent = Math.max(0, this.params.health / this.params.maxHealth);
    this.barMesh.scale.x = healthPercent;

    // Color transition
    if (healthPercent > 0.6) this.barMesh.material.color.setHex(0x00ff00);
    else if (healthPercent > 0.3) this.barMesh.material.color.setHex(0xffff00);
    else this.barMesh.material.color.setHex(0xff0000);

    // Hide if dead
    if (healthPercent <= 0) {
      this.container.visible = false;
    }
  }

  Cleanup() {
    if (this.container) {
      this.scene.remove(this.container);
      this.bgMesh.geometry.dispose();
      this.bgMesh.material.dispose();
      this.barMesh.geometry.dispose();
      this.barMesh.material.dispose();
    }
  }
}
