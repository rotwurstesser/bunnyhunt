import * as THREE from 'three'
import Component from '../../Component'
import { WEAPONS } from '../Player/WeaponConfig'

export default class WeaponPickup extends Component {
    constructor(scene, weaponKey, position, weaponAssets = null) {
        super();
        this.name = 'WeaponPickup';
        this.scene = scene;
        this.weaponKey = weaponKey;
        this.weaponAssets = weaponAssets;
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
        const config = WEAPONS[this.weaponKey];
        const color = config.glowColor || 0x44ff44;

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
            side: THREE.DoubleSide
        });
        this.sphere = new THREE.Mesh(sphereGeo, sphereMat);
        this.container.add(this.sphere);

        // Add glow effect around sphere
        const glowGeo = new THREE.SphereGeometry(sphereRadius * 1.1, 16, 16);
        const glowMat = new THREE.MeshBasicMaterial({
            color: color,
            transparent: true,
            opacity: 0.15,
            side: THREE.BackSide
        });
        this.glow = new THREE.Mesh(glowGeo, glowMat);
        this.container.add(this.glow);

        // Create weapon model inside the sphere
        this.CreateWeaponModel(config, sphereRadius * 0.7);

        // Add floating text label above
        this.CreateLabel(config.name, color);
    }

    CreateWeaponModel(config, maxSize) {
        const modelKey = config.modelKey;

        // Try to get actual weapon model from assets
        if (this.weaponAssets && this.weaponAssets[modelKey]) {
            const sourceModel = this.weaponAssets[modelKey];
            this.weaponMesh = sourceModel.clone();

            // Scale to fit inside sphere
            const scale = config.pickupScale || 0.05;
            this.weaponMesh.scale.set(scale, scale, scale);

            // Center the weapon
            this.weaponMesh.position.set(0, 0, 0);

            // Apply shadows
            this.weaponMesh.traverse(child => {
                if (child.isMesh) {
                    child.castShadow = true;
                }
            });

            this.container.add(this.weaponMesh);
        } else {
            // Fallback: Create simple colored box if no asset available
            const boxSize = maxSize * 0.6;
            const boxGeo = new THREE.BoxGeometry(boxSize * 1.5, boxSize * 0.5, boxSize * 0.3);
            const boxMat = new THREE.MeshStandardMaterial({
                color: config.glowColor || 0x888888,
                emissive: config.glowColor || 0x888888,
                emissiveIntensity: 0.3,
                metalness: 0.8,
                roughness: 0.3
            });
            this.weaponMesh = new THREE.Mesh(boxGeo, boxMat);
            this.container.add(this.weaponMesh);
        }
    }

    CreateLabel(text, color) {
        // Create canvas for text
        const canvas = document.createElement('canvas');
        canvas.width = 256;
        canvas.height = 64;
        const ctx = canvas.getContext('2d');

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
            transparent: true
        });
        this.label = new THREE.Sprite(spriteMat);
        this.label.scale.set(1.5, 0.4, 1);
        this.label.position.y = 0.9;
        this.container.add(this.label);
    }

    CheckPlayerDistance() {
        if (!this.player || this.collected) return;

        const playerPos = this.player.Position;
        const pickupPos = this.container.position;

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
        if (this.container) {
            this.container.scale.set(1.5, 1.5, 1.5);
            setTimeout(() => {
                this.Cleanup();
            }, 100);
        }
    }

    Cleanup() {
        if (this.container) {
            this.scene.remove(this.container);

            // Dispose sphere
            if (this.sphere) {
                this.sphere.geometry.dispose();
                this.sphere.material.dispose();
            }

            // Dispose glow
            if (this.glow) {
                this.glow.geometry.dispose();
                this.glow.material.dispose();
            }

            // Dispose weapon mesh
            if (this.weaponMesh) {
                this.weaponMesh.traverse(child => {
                    if (child.isMesh) {
                        child.geometry?.dispose();
                        if (child.material) {
                            if (Array.isArray(child.material)) {
                                child.material.forEach(m => m.dispose());
                            } else {
                                child.material.dispose();
                            }
                        }
                    }
                });
            }

            // Dispose label
            if (this.label) {
                this.label.material.map.dispose();
                this.label.material.dispose();
            }

            this.container = null;
        }
        this.collected = true;
    }

    Update(t) {
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
