import * as THREE from 'three'
import Component from '../../Component'

export default class AmmoPickup extends Component {
    constructor(scene, position) {
        super();
        this.name = 'AmmoPickup';
        this.scene = scene;
        this.spawnPosition = position.clone();
        this.pickupRadius = 2.0;
        this.collected = false;
        this.bobTime = Math.random() * Math.PI * 2;
        this.bobSpeed = 2.5;
        this.bobHeight = 0.2;
        this.rotateSpeed = 2.0;
        this.baseHeight = 0.8;
        this.ammoAmount = 30; // Ammo to give
    }

    Initialize() {
        this.player = this.FindEntity('Player');
        this.CreateVisual();
    }

    CreateVisual() {
        // Create ammo box
        const boxGeo = new THREE.BoxGeometry(0.4, 0.25, 0.3);
        const boxMat = new THREE.MeshStandardMaterial({
            color: 0x5c4033,
            emissive: 0x332211,
            emissiveIntensity: 0.2,
            metalness: 0.3,
            roughness: 0.7
        });
        this.mesh = new THREE.Mesh(boxGeo, boxMat);
        this.mesh.position.copy(this.spawnPosition);
        this.mesh.position.y = this.baseHeight;
        this.mesh.castShadow = true;
        this.scene.add(this.mesh);

        // Add bullet decoration on top
        const bulletGeo = new THREE.CylinderGeometry(0.03, 0.03, 0.15, 8);
        const bulletMat = new THREE.MeshStandardMaterial({
            color: 0xd4af37,
            metalness: 0.9,
            roughness: 0.1
        });

        // Add 3 bullets on top
        for (let i = 0; i < 3; i++) {
            const bullet = new THREE.Mesh(bulletGeo, bulletMat);
            bullet.position.set(-0.1 + i * 0.1, 0.2, 0);
            bullet.rotation.x = Math.PI / 2;
            this.mesh.add(bullet);
        }

        // Add glow effect
        const glowGeo = new THREE.SphereGeometry(0.5, 8, 8);
        const glowMat = new THREE.MeshBasicMaterial({
            color: 0xffcc00,
            transparent: true,
            opacity: 0.15
        });
        this.glow = new THREE.Mesh(glowGeo, glowMat);
        this.mesh.add(this.glow);

        // Add label
        this.CreateLabel();
    }

    CreateLabel() {
        const canvas = document.createElement('canvas');
        canvas.width = 128;
        canvas.height = 32;
        const ctx = canvas.getContext('2d');

        ctx.font = 'bold 20px Arial';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.strokeStyle = 'black';
        ctx.lineWidth = 3;
        ctx.strokeText('AMMO', 64, 16);
        ctx.fillStyle = '#ffcc00';
        ctx.fillText('AMMO', 64, 16);

        const texture = new THREE.CanvasTexture(canvas);
        const spriteMat = new THREE.SpriteMaterial({
            map: texture,
            transparent: true
        });
        this.label = new THREE.Sprite(spriteMat);
        this.label.scale.set(1, 0.25, 1);
        this.label.position.y = 0.6;
        this.mesh.add(this.label);
    }

    CheckPlayerDistance() {
        if (!this.player || this.collected) return;

        const playerPos = this.player.Position;
        const pickupPos = this.mesh.position;

        const dx = playerPos.x - pickupPos.x;
        const dz = playerPos.z - pickupPos.z;
        const distSq = dx * dx + dz * dz;

        if (distSq < this.pickupRadius * this.pickupRadius) {
            this.OnCollected();
        }
    }

    OnCollected() {
        if (this.collected) return;
        this.collected = true;

        // Notify player's weapon to add ammo
        if (this.player) {
            this.player.Broadcast({
                topic: 'AmmoPickup',
                amount: this.ammoAmount
            });
        }

        // Quick pickup effect
        if (this.mesh) {
            this.mesh.scale.set(1.3, 1.3, 1.3);
            setTimeout(() => {
                this.Cleanup();
            }, 80);
        }
    }

    Cleanup() {
        if (this.mesh) {
            this.scene.remove(this.mesh);
            this.mesh.geometry.dispose();
            this.mesh.material.dispose();
            if (this.glow) {
                this.glow.geometry.dispose();
                this.glow.material.dispose();
            }
            if (this.label) {
                this.label.material.map.dispose();
                this.label.material.dispose();
            }
            this.mesh = null;
        }
        this.collected = true;
    }

    Update(t) {
        if (this.collected || !this.mesh) return;

        // Bob up and down
        this.bobTime += t * this.bobSpeed;
        this.mesh.position.y = this.baseHeight + Math.sin(this.bobTime) * this.bobHeight;

        // Rotate
        this.mesh.rotation.y += t * this.rotateSpeed;

        // Pulse glow
        if (this.glow) {
            const pulse = 0.12 + Math.sin(this.bobTime * 2) * 0.05;
            this.glow.material.opacity = pulse;
        }

        // Check for player pickup
        this.CheckPlayerDistance();
    }
}
