import * as THREE from 'three'
import Component from '../../Component'
import Input from '../../Input'
import {Ammo, AmmoHelper, CollisionFilterGroups} from '../../AmmoLib'

import WeaponFSM from './WeaponFSM';
import { getWeaponConfig, WEAPONS, WEAPON_TIERS, WEAPON_THRESHOLDS } from './WeaponConfig';


export default class Weapon extends Component{
    constructor(camera, assets, flash, world, shotSoundBuffer, listener, nukeProjectileFactory = null){
        super();
        this.name = 'Weapon';
        this.camera = camera;
        this.world = world;
        this.assets = assets;  // All weapon model assets
        this.flash = flash;
        this.currentModel = null; // Currently displayed weapon model
        this.animations = {};
        this.shoot = false;
        this.shootTimer = 0.0;

        this.shotSoundBuffer = shotSoundBuffer;
        this.audioListener = listener;
        this.nukeProjectileFactory = nukeProjectileFactory;

        // Current weapon config
        this.currentWeaponKey = 'rifle';
        this.currentTier = 0;

        // Initialize with rifle config
        this.ApplyWeaponConfig('rifle');

        this.uimanager = null;
        this.reloading = false;
        this.hitResult = {intersectionPoint: new THREE.Vector3(), intersectionNormal: new THREE.Vector3()};
        this.inputSetup = false;
        this.impactEffects = []; // Track impact effects for cleanup
    }

    ApplyWeaponConfig(weaponKey) {
        const config = getWeaponConfig(weaponKey);
        this.currentWeaponKey = weaponKey;
        this.fireRate = config.fireRate;
        this.damage = config.damage;
        this.magAmmo = config.magAmmo;
        this.ammoPerMag = config.ammoPerMag;
        this.ammo = config.maxAmmo;
        this.weaponType = config.type;
        this.modelScale = config.modelScale;
        this.muzzleFlashScale = config.muzzleFlashScale || 1.0;
        this.recoil = config.recoil || 0.01;
        this.weaponName = config.name;
    }

    SetAnim(name, clip){
        if (!clip) {
            console.warn(`Weapon animation '${name}' not found`);
            return;
        }
        const action = this.mixer.clipAction(clip);
        this.animations[name] = {clip, action};
    }

    SetAnimations(){
        this.mixer = new THREE.AnimationMixer( this.model );
        const anims = this.model.animations || [];
        this.SetAnim('idle', anims[1]);
        this.SetAnim('reload', anims[2]);
        this.SetAnim('shoot', anims[0]);
    }

    SetMuzzleFlash(){
        // Position flash in front of weapon (will be re-attached in SwitchWeapon)
        this.flash.position.set(0, 0, -0.5);
        this.flash.rotateY(Math.PI);
        this.flash.life = 0.0;
        this.flash.scale.set(0.3, 0.3, 0.3);

        if (this.flash.children[0]?.material) {
            this.flash.children[0].material.blending = THREE.AdditiveBlending;
        }
    }

    SetSoundEffect(){
        this.shotSound = new THREE.Audio(this.audioListener);
        this.shotSound.setBuffer(this.shotSoundBuffer);
        this.shotSound.setLoop(false);
    }

    AmmoPickup = (e) => {
        // Add ammo based on current weapon
        const config = getWeaponConfig(this.currentWeaponKey);
        this.ammo = Math.min(this.ammo + 30, config.maxAmmo);
        this.uimanager.SetAmmo(this.magAmmo, this.ammo);
    }

    OnWeaponUpgrade = (msg) => {
        const newTier = msg.tier;
        if (newTier > this.currentTier && newTier < WEAPON_TIERS.length) {
            this.currentTier = newTier;
            const newWeaponKey = WEAPON_TIERS[newTier];
            this.SwitchWeapon(newWeaponKey);
        }
    }

    SwitchWeapon(weaponKey) {
        // Stop any current action
        this.shoot = false;
        this.reloading = false;

        // Apply new weapon config
        this.ApplyWeaponConfig(weaponKey);

        // Remove old model from camera
        if (this.currentModel) {
            this.camera.remove(this.currentModel);
        }

        // Get new model from config
        const config = WEAPONS[weaponKey];
        const modelKey = config.modelKey;
        const sourceModel = this.assets[modelKey];

        if (sourceModel) {
            // Clone the model
            this.currentModel = sourceModel.clone();

            // Apply scale
            const scale = config.modelScale;
            this.currentModel.scale.set(scale, scale, scale);

            // Apply position offset (for FPS view without arms)
            const pos = config.positionOffset;
            this.currentModel.position.set(pos.x, pos.y, pos.z);

            // Apply rotation offset
            const rot = config.rotationOffset;
            this.currentModel.rotation.set(rot.x, rot.y, rot.z);

            // Setup shadows
            this.currentModel.traverse(child => {
                if (child.isMesh) {
                    child.castShadow = true;
                    child.receiveShadow = true;
                }
            });

            // Add to camera
            this.camera.add(this.currentModel);

            // Re-attach muzzle flash to new model
            if (this.flash) {
                this.flash.position.set(0, 0, -0.5);
                this.currentModel.add(this.flash);
            }
        }

        // Reset state machine to idle
        if (this.stateMachine) {
            this.stateMachine.SetState('idle');
        }

        // Update UI
        if (this.uimanager) {
            this.uimanager.SetAmmo(this.magAmmo, this.ammo);
            this.uimanager.SetWeaponName(this.weaponName);
            this.uimanager.ShowUpgradeNotification(this.weaponName);
        }
    }

    Initialize(){
        // Setup muzzle flash first
        this.SetMuzzleFlash();
        this.SetSoundEffect();

        // Initialize with starting weapon using SwitchWeapon
        this.SwitchWeapon(this.currentWeaponKey);

        // Create a simple state machine for weapon states
        this.stateMachine = new WeaponFSM(this);
        this.stateMachine.SetState('idle');

        this.uimanager = this.FindEntity("UIManager").GetComponent("UIManager");
        this.uimanager.SetAmmo(this.magAmmo, this.ammo);
        this.uimanager.SetWeaponName(this.weaponName);

        // Get scene reference for impact effects
        const level = this.FindEntity("Level");
        this.scene = level?.GetComponent("TileManager")?.scene || level?.GetComponent("ForestLighting")?.scene;

        if (!this.inputSetup) {
            this.SetupInput();
            this.inputSetup = true;
        }

        // Listen to ammo pickup event
        this.parent.RegisterEventHandler(this.AmmoPickup, "AmmoPickup");

        // Listen to weapon pickup event (from pickups in world)
        this.parent.RegisterEventHandler(this.OnWeaponPickup, "weapon_pickup");

        // Listen to weapon upgrade event (legacy - from kill thresholds)
        this.parent.RegisterEventHandler(this.OnWeaponUpgrade, "weapon_upgrade");
    }

    OnWeaponPickup = (msg) => {
        const newWeaponKey = msg.weaponKey;
        if (newWeaponKey && newWeaponKey !== this.currentWeaponKey) {
            this.SwitchWeapon(newWeaponKey);
        }
    }

    SetupInput(){
        Input.AddMouseDownListner( e => {
            if(e.button != 0 || this.reloading){
                return;
            }

            this.shoot = true;
            this.shootTimer = 0.0;
        });

        Input.AddMouseUpListner( e => {
            if(e.button != 0){
                return;
            }

            this.shoot = false;
        });

        Input.AddKeyDownListner(e => {
            if(e.repeat) return;

            if(e.code == "KeyR"){
                this.Reload();
            }
        });
    }

    Reload(){
        if(this.reloading || this.magAmmo == this.ammoPerMag || this.ammo == 0){
            return;
        }

        this.reloading = true;
        this.stateMachine?.SetState('reload');
    }

    ReloadDone(){
        this.reloading = false;
        const bulletsNeeded = this.ammoPerMag - this.magAmmo;
        this.magAmmo = Math.min(this.ammo + this.magAmmo, this.ammoPerMag);
        this.ammo = Math.max(0, this.ammo - bulletsNeeded);
        this.uimanager.SetAmmo(this.magAmmo, this.ammo);
    }

    Raycast(){
        try {
            const start = new THREE.Vector3(0.0, 0.0, -1.0);
            start.unproject(this.camera);
            const end = new THREE.Vector3(0.0, 0.0, 1.0);
            end.unproject(this.camera);

            // Include SensorTrigger so we can hit animals
            const collisionMask = CollisionFilterGroups.AllFilter;

            const hit = AmmoHelper.CastRay(this.world, start, end, this.hitResult, collisionMask);

            if(hit){
                const collisionObj = this.hitResult.collisionObject;
                if (!collisionObj) return;

                // Look up entity from collision object registry
                const entity = AmmoHelper.GetEntityFromCollisionObject(collisionObj);

                // Determine what was hit and create appropriate impact effect
                let isLiving = false;
                if (entity && entity.Broadcast) {
                    entity.Broadcast({'topic': 'hit', from: this.parent, amount: this.damage, hitResult: this.hitResult});
                    isLiving = true; // Hit an entity (animal)
                }

                // Create impact effect at hit point
                this.CreateImpactEffect(this.hitResult.intersectionPoint, isLiving);
            }
        } catch (e) {
            console.error('Weapon.Raycast error:', e);
        }
    }

    CreateImpactEffect(position, isLiving) {
        if (!this.scene) return;

        // Create small sphere for impact
        const size = isLiving ? 0.15 : 0.08; // Slightly larger for blood
        const color = isLiving ? 0xAA0000 : 0x8B4513; // Red for blood, brown for wood/ground

        const geometry = new THREE.SphereGeometry(size, 8, 8);
        const material = new THREE.MeshBasicMaterial({
            color: color,
            transparent: true,
            opacity: 1.0
        });
        const impact = new THREE.Mesh(geometry, material);
        impact.position.copy(position);
        impact.position.y += 0.05; // Slightly above surface
        this.scene.add(impact);

        // Track for cleanup
        const effectData = {
            mesh: impact,
            life: 0.5, // Fade out over 0.5 seconds
            maxLife: 0.5
        };
        this.impactEffects.push(effectData);

        // Also schedule removal after 0.5 seconds
        setTimeout(() => {
            this.RemoveImpactEffect(effectData);
        }, 500);
    }

    RemoveImpactEffect(effectData) {
        if (effectData.mesh && this.scene) {
            this.scene.remove(effectData.mesh);
            effectData.mesh.geometry.dispose();
            effectData.mesh.material.dispose();
        }
        const idx = this.impactEffects.indexOf(effectData);
        if (idx > -1) {
            this.impactEffects.splice(idx, 1);
        }
    }

    FireNuke() {
        // Get camera forward direction
        const forward = new THREE.Vector3(0, 0, -1);
        forward.applyQuaternion(this.camera.quaternion);

        const startPos = this.camera.position.clone();
        startPos.add(forward.clone().multiplyScalar(1.0)); // Start 1 unit in front of camera

        // Broadcast nuke fired event - SpawnManager will create the projectile
        const spawnManager = this.FindEntity("SpawnManager");
        if (spawnManager) {
            spawnManager.Broadcast({
                topic: 'nuke_fired',
                startPosition: startPos,
                direction: forward,
                camera: this.camera
            });
        }

        // Also trigger immediate screen shake/flash
        this.TriggerNukeEffects();
    }

    TriggerNukeEffects() {
        // Screen flash effect
        const flashOverlay = document.createElement('div');
        flashOverlay.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: white;
            opacity: 0.8;
            pointer-events: none;
            z-index: 9999;
            transition: opacity 0.5s ease-out;
        `;
        document.body.appendChild(flashOverlay);

        setTimeout(() => {
            flashOverlay.style.opacity = '0';
            setTimeout(() => flashOverlay.remove(), 500);
        }, 100);
    }

    Shoot(t){
        if(!this.shoot){
            return;
        }

        if(!this.magAmmo){
            // Reload automatically
            this.Reload();
            return;
        }

        if(this.shootTimer <= 0.0 ){
            // Handle nuke weapon specially
            if (this.weaponType === 'projectile' && this.currentWeaponKey === 'nuke') {
                this.FireNuke();
                this.magAmmo = 0;
                this.ammo = 0;
                this.shoot = false;
                this.uimanager.SetAmmo(this.magAmmo, this.ammo);
                return;
            }

            // Normal hitscan shooting
            this.flash.life = this.fireRate;
            this.flash.rotateZ(Math.PI * Math.random());
            const scale = Math.random() * (1.5 - 0.8) + 0.8;
            this.flash.scale.set(scale * this.muzzleFlashScale, this.muzzleFlashScale, this.muzzleFlashScale);
            this.shootTimer = this.fireRate;
            this.magAmmo = Math.max(0, this.magAmmo - 1);
            this.uimanager.SetAmmo(this.magAmmo, this.ammo);

            this.Raycast();
            this.Broadcast({topic: 'weapon_shot', weapon: this.currentWeaponKey});

            this.shotSound.isPlaying && this.shotSound.stop();
            this.shotSound.play();

            // Apply recoil
            this.ApplyRecoil();
        }

        this.shootTimer = Math.max(0.0, this.shootTimer - t);
    }

    ApplyRecoil() {
        if (!this.currentModel) return;

        // Simple visual recoil - kick the model up and back slightly
        const originalY = this.currentModel.position.y;
        const originalZ = this.currentModel.position.z;
        this.currentModel.position.y += this.recoil;
        this.currentModel.position.z += this.recoil * 0.5;

        // Animate back to original position
        setTimeout(() => {
            if (this.currentModel) {
                this.currentModel.position.y = originalY;
                this.currentModel.position.z = originalZ;
            }
        }, 50);
    }

    AnimateMuzzle(t){
        const mat = this.flash.children[0]?.material;
        if (!mat) return;
        const ratio = this.flash.life / this.fireRate;
        mat.opacity = ratio;
        this.flash.life = Math.max(0.0, this.flash.life - t);
    }

    Update(t){
        this.mixer?.update(t);
        this.stateMachine?.Update(t);
        this.Shoot(t);
        this.AnimateMuzzle(t);
    }

}
