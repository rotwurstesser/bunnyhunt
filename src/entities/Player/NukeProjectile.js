import * as THREE from 'three'
import Component from '../../Component'

export default class NukeProjectile extends Component {
    constructor(scene, startPosition, direction) {
        super();
        this.name = 'NukeProjectile';
        this.scene = scene;
        this.startPosition = startPosition.clone();
        this.direction = direction.clone().normalize();
        this.position = startPosition.clone();
        this.velocity = 30.0; // m/s
        this.hasDetonated = false;
        this.lifetime = 0;
        this.maxLifetime = 10; // Detonate after 10 seconds if no collision
        this.mesh = null;
        this.trailParticles = [];
    }

    Initialize() {
        // Create the projectile visual - glowing sphere
        const geometry = new THREE.SphereGeometry(0.3, 16, 16);
        const material = new THREE.MeshBasicMaterial({
            color: 0xff4400,
            emissive: 0xff4400,
            emissiveIntensity: 2
        });
        this.mesh = new THREE.Mesh(geometry, material);
        this.mesh.position.copy(this.position);
        this.scene.add(this.mesh);

        // Add a point light for glow effect
        this.light = new THREE.PointLight(0xff4400, 2, 10);
        this.mesh.add(this.light);

        // Create trail effect
        this.CreateTrail();
    }

    CreateTrail() {
        // Simple trail using small spheres
        const trailGeometry = new THREE.SphereGeometry(0.1, 8, 8);
        const trailMaterial = new THREE.MeshBasicMaterial({
            color: 0xff6600,
            transparent: true,
            opacity: 0.5
        });

        for (let i = 0; i < 10; i++) {
            const trail = new THREE.Mesh(trailGeometry, trailMaterial.clone());
            trail.position.copy(this.position);
            trail.visible = false;
            this.scene.add(trail);
            this.trailParticles.push({
                mesh: trail,
                delay: i * 0.05
            });
        }
    }

    UpdateTrail(t) {
        this.trailParticles.forEach((particle, index) => {
            if (this.lifetime > particle.delay) {
                particle.mesh.visible = true;
                // Lerp towards current position
                particle.mesh.position.lerp(this.position, 0.1);
                // Fade out
                particle.mesh.material.opacity = Math.max(0, 0.5 - index * 0.05);
            }
        });
    }

    Detonate() {
        if (this.hasDetonated) return;
        this.hasDetonated = true;

        // Create explosion visual
        this.CreateExplosionEffect();

        // Trigger nuke detonation event
        const spawnManager = this.FindEntity("SpawnManager");
        if (spawnManager) {
            spawnManager.Broadcast({ topic: 'nuke_detonated' });
        }

        // Clean up projectile
        this.Cleanup();
    }

    CreateExplosionEffect() {
        // Create expanding explosion sphere
        const explosionGeometry = new THREE.SphereGeometry(1, 32, 32);
        const explosionMaterial = new THREE.MeshBasicMaterial({
            color: 0xffff00,
            transparent: true,
            opacity: 0.9
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
            side: THREE.DoubleSide
        });
        const ring = new THREE.Mesh(ringGeometry, ringMaterial);
        ring.position.copy(this.position);
        ring.rotation.x = -Math.PI / 2;
        this.scene.add(ring);

        // Animate explosion
        let scale = 1;
        let ringScale = 1;
        const animateExplosion = () => {
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
        this.ScreenFlash();
    }

    ScreenFlash() {
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

    Cleanup() {
        // Remove mesh
        if (this.mesh) {
            this.scene.remove(this.mesh);
            this.mesh.geometry.dispose();
            this.mesh.material.dispose();
        }

        // Remove trail
        this.trailParticles.forEach(particle => {
            this.scene.remove(particle.mesh);
            particle.mesh.geometry.dispose();
            particle.mesh.material.dispose();
        });

        // Remove entity from manager after a frame
        setTimeout(() => {
            const entityManager = this.parent.parent;
            if (entityManager) {
                entityManager.Remove(this.parent);
            }
        }, 100);
    }

    CheckCollision() {
        // Simple ground collision check
        if (this.position.y <= 0.5) {
            return true;
        }

        // Could add more sophisticated collision detection here
        return false;
    }

    Update(t) {
        if (this.hasDetonated) return;

        this.lifetime += t;

        // Move projectile
        const movement = this.direction.clone().multiplyScalar(this.velocity * t);
        this.position.add(movement);

        // Apply gravity (slight arc)
        this.direction.y -= 0.3 * t;

        // Update mesh position
        if (this.mesh) {
            this.mesh.position.copy(this.position);
            // Spin the projectile
            this.mesh.rotation.x += t * 5;
            this.mesh.rotation.z += t * 3;
        }

        // Update trail
        this.UpdateTrail(t);

        // Check for collision or max lifetime
        if (this.CheckCollision() || this.lifetime >= this.maxLifetime) {
            this.Detonate();
        }
    }
}
