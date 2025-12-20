import * as THREE from 'three'
import Component from '../../Component'
import { WEAPONS } from '../Player/WeaponConfig'

export default class WeaponPickup extends Component {
    constructor(scene, weaponKey, position) {
        super();
        this.name = 'WeaponPickup';
        this.scene = scene;
        this.weaponKey = weaponKey;
        this.spawnPosition = position.clone();
        this.pickupRadius = 2.0;
        this.collected = false;
        this.bobTime = Math.random() * Math.PI * 2; // Random start phase
        this.bobSpeed = 2.0;
        this.bobHeight = 0.3;
        this.rotateSpeed = 1.5;
        this.baseHeight = 1.2; // Float above ground
    }

    Initialize() {
        this.player = this.FindEntity('Player');
        this.CreateVisual();
    }

    CreateVisual() {
        // Create a glowing weapon box representation
        const config = WEAPONS[this.weaponKey];

        // Box geometry sized by weapon tier
        let boxSize = 0.4;
        let color = 0x44aa44; // Green for AK
        let emissiveIntensity = 0.3;

        if (this.weaponKey === 'gatling') {
            boxSize = 0.5;
            color = 0x4444ff; // Blue for Gatling
            emissiveIntensity = 0.5;
        } else if (this.weaponKey === 'nuke') {
            boxSize = 0.6;
            color = 0xff4444; // Red for Nuke
            emissiveIntensity = 0.8;
        }

        // Main box
        const boxGeo = new THREE.BoxGeometry(boxSize * 1.5, boxSize, boxSize * 0.6);
        const boxMat = new THREE.MeshStandardMaterial({
            color: color,
            emissive: color,
            emissiveIntensity: emissiveIntensity,
            metalness: 0.8,
            roughness: 0.2
        });
        this.mesh = new THREE.Mesh(boxGeo, boxMat);
        this.mesh.position.copy(this.spawnPosition);
        this.mesh.position.y = this.baseHeight;
        this.mesh.castShadow = true;
        this.scene.add(this.mesh);

        // Add glow ring
        const ringGeo = new THREE.TorusGeometry(boxSize * 1.2, 0.05, 8, 32);
        const ringMat = new THREE.MeshBasicMaterial({
            color: color,
            transparent: true,
            opacity: 0.6
        });
        this.ring = new THREE.Mesh(ringGeo, ringMat);
        this.ring.rotation.x = Math.PI / 2;
        this.mesh.add(this.ring);

        // Add floating text indicator (simple sprite)
        this.CreateLabel(config.name, color);
    }

    CreateLabel(text, color) {
        // Create canvas for text
        const canvas = document.createElement('canvas');
        canvas.width = 256;
        canvas.height = 64;
        const ctx = canvas.getContext('2d');

        ctx.fillStyle = 'transparent';
        ctx.fillRect(0, 0, 256, 64);

        ctx.font = 'bold 32px Arial';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';

        // Text outline
        ctx.strokeStyle = 'black';
        ctx.lineWidth = 4;
        ctx.strokeText(text, 128, 32);

        // Text fill
        ctx.fillStyle = '#' + color.toString(16).padStart(6, '0');
        ctx.fillText(text, 128, 32);

        const texture = new THREE.CanvasTexture(canvas);
        const spriteMat = new THREE.SpriteMaterial({
            map: texture,
            transparent: true
        });
        this.label = new THREE.Sprite(spriteMat);
        this.label.scale.set(2, 0.5, 1);
        this.label.position.y = 0.8;
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

        // Notify player's weapon to switch
        if (this.player) {
            this.player.Broadcast({
                topic: 'weapon_pickup',
                weaponKey: this.weaponKey
            });
        }

        // Play pickup effect (quick scale up then remove)
        this.PlayPickupEffect();
    }

    PlayPickupEffect() {
        // Quick flash effect
        if (this.mesh) {
            this.mesh.scale.set(1.5, 1.5, 1.5);
            setTimeout(() => {
                this.Cleanup();
            }, 100);
        }
    }

    Cleanup() {
        if (this.mesh) {
            this.scene.remove(this.mesh);
            // Dispose geometries and materials
            this.mesh.geometry.dispose();
            this.mesh.material.dispose();
            if (this.ring) {
                this.ring.geometry.dispose();
                this.ring.material.dispose();
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

        // Pulse the ring
        if (this.ring) {
            const pulse = 0.8 + Math.sin(this.bobTime * 2) * 0.2;
            this.ring.scale.set(pulse, pulse, pulse);
        }

        // Check for player pickup
        this.CheckPlayerDistance();
    }
}
