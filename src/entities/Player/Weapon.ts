/**
 * Weapon Component
 *
 * Handles weapon firing, reloading, switching, and visual effects.
 * Uses configuration from weapons.config.ts.
 */

import * as THREE from 'three';
import Component from '../../core/Component';
import Input from '../../core/Input';
import { Ammo, AmmoHelper, CollisionFilterGroups } from '../../core/AmmoLib';
import WeaponFSM, { type WeaponAnimation, type WeaponState } from './WeaponFSM';
import {
  getWeaponConfig,
  WEAPONS,
  WEAPON_TIERS,
  type WeaponKey,
  type WeaponConfig,
  type WeaponAnimationName,
} from '../../config/weapons.config';
import type { HitEvent, WeaponUpgradeEvent, WeaponPickupEvent, AmmoPickupEvent } from '../../types/events.types';

// ============================================================================
// TYPES
// ============================================================================

/** Raycast hit result */
interface HitResult {
  intersectionPoint: THREE.Vector3;
  intersectionNormal: THREE.Vector3;
  collisionObject?: unknown;
}

/** Impact effect tracking */
interface ImpactEffect {
  mesh: THREE.Mesh;
  life: number;
  maxLife: number;
}

/** UI Manager interface */
interface UIManagerComponent {
  SetAmmo(magAmmo: number, totalAmmo: number): void;
  SetHealth(health: number): void;
  SetWeaponName(name: string): void;
  ShowUpgradeNotification(name: string): void;
  SetWeaponList(owned: string[], current: string): void;
}

/** Asset dictionary for weapon models */
type WeaponAssets = Record<string, THREE.Object3D>;

// ============================================================================
// WEAPON COMPONENT
// ============================================================================

export default class Weapon extends Component {
  override name = 'Weapon';

  // ============================================================================
  // DEPENDENCIES
  // ============================================================================

  private readonly camera: THREE.Camera;
  private readonly world: unknown; // Ammo physics world
  private readonly assets: WeaponAssets;
  private readonly flash: THREE.Object3D;
  private readonly shotSoundBuffer: AudioBuffer;
  private readonly audioListener: THREE.AudioListener;
  private readonly nukeProjectileFactory: unknown | null;

  // ============================================================================
  // STATE
  // ============================================================================

  /** Current weapon key */
  private currentWeaponKey: WeaponKey = 'rifle';

  /** Owned weapons list */
  private ownedWeapons: WeaponKey[] = ['rifle'];

  /** Current weapon index in owned list */
  private currentWeaponIndex: number = 0;

  /** Weapon ammo storage */
  private weaponAmmo: Record<string, { mag: number; reserve: number }> = {};

  /** Current weapon tier (0-3) */
  private currentTier: number = 0;

  /** Current weapon config */
  private config: WeaponConfig;

  /** Magazine ammo */
  public magAmmo: number;

  /** Total reserve ammo */
  private ammo: number;

  /** Is currently shooting */
  public shoot: boolean = false;

  /** Shoot cooldown timer */
  private shootTimer: number = 0.0;

  /** Is currently reloading */
  private reloading: boolean = false;

  /** Currently displayed weapon model */
  private currentModel: THREE.Object3D | null = null;

  /** Animation clips and actions */
  public animations: Record<WeaponAnimationName, WeaponAnimation | undefined> = {
    idle: undefined,
    shoot: undefined,
    reload: undefined,
  };

  /** Animation mixer */
  public mixer: THREE.AnimationMixer | null = null;

  /** State machine */
  private stateMachine: WeaponFSM | null = null;

  /** Sound effect */
  private shotSound: THREE.Audio | null = null;

  /** UI manager reference */
  private uimanager: UIManagerComponent | null = null;

  /** Scene reference for effects */
  private scene: THREE.Scene | null = null;

  /** Impact effects for cleanup */
  private impactEffects: ImpactEffect[] = [];

  /** Hit result (reusable) */
  private hitResult: HitResult = {
    intersectionPoint: new THREE.Vector3(),
    intersectionNormal: new THREE.Vector3(),
  };

  /** Input setup flag */
  private inputSetup: boolean = false;

  // ============================================================================
  // CONSTRUCTOR
  // ============================================================================

  constructor(
    camera: THREE.Camera,
    assets: WeaponAssets,
    flash: THREE.Object3D,
    world: unknown,
    shotSoundBuffer: AudioBuffer,
    listener: THREE.AudioListener,
    nukeProjectileFactory: unknown | null = null
  ) {
    super();
    this.camera = camera;
    this.world = world;
    this.assets = assets;
    this.flash = flash;
    this.shotSoundBuffer = shotSoundBuffer;
    this.audioListener = listener;
    this.nukeProjectileFactory = nukeProjectileFactory;

    // Initialize with rifle config
    this.config = getWeaponConfig('rifle');
    this.magAmmo = this.config.magAmmo;
    this.ammo = this.config.maxAmmo;

    // Init ammo storage
    Object.keys(WEAPONS).forEach((k) => {
      const conf = WEAPONS[k as WeaponKey];
      this.weaponAmmo[k] = { mag: conf.magAmmo, reserve: conf.maxAmmo };
    });
  }

  // ============================================================================
  // INITIALIZATION
  // ============================================================================

  override Initialize(): void {
    // Setup muzzle flash first
    this.setupMuzzleFlash();
    this.setupSoundEffect();

    // Initialize with starting weapon
    this.switchWeapon(this.currentWeaponKey);

    // Create state machine
    this.stateMachine = new WeaponFSM(this);
    this.stateMachine.SetState('idle');

    // Get UI manager
    const uiEntity = this.FindEntity('UIManager');
    this.uimanager = uiEntity?.GetComponent('UIManager') as UIManagerComponent | undefined ?? null;
    if (this.uimanager) {
      this.uimanager.SetAmmo(this.magAmmo, this.ammo);
      this.uimanager.SetWeaponName(this.config.name);
    }

    // Get scene reference for impact effects
    const level = this.FindEntity('Level');
    const tileManager = level?.GetComponent('TileManager') as { scene?: THREE.Scene } | undefined;
    const forestLighting = level?.GetComponent('ForestLighting') as { scene?: THREE.Scene } | undefined;
    this.scene = tileManager?.scene ?? forestLighting?.scene ?? null;

    // Setup input
    if (!this.inputSetup) {
      this.setupInput();
      this.inputSetup = true;
    }

    // Register event handlers
    this.parent!.RegisterEventHandler(this.onAmmoPickup, 'AmmoPickup');
    this.parent!.RegisterEventHandler(this.onWeaponPickup, 'weapon_pickup');
    this.parent!.RegisterEventHandler(this.onWeaponUpgrade, 'weapon_upgrade');
  }

  // ============================================================================
  // SETUP METHODS
  // ============================================================================

  private setupMuzzleFlash(): void {
    this.flash.position.set(0, 0, -0.5);
    this.flash.rotateY(Math.PI);
    (this.flash as { life?: number }).life = 0.0;
    this.flash.scale.set(0.3, 0.3, 0.3);

    const child = this.flash.children[0] as THREE.Mesh | undefined;
    if (child?.material) {
      (child.material as THREE.Material).blending = THREE.AdditiveBlending;
    }
  }

  private setupSoundEffect(): void {
    this.shotSound = new THREE.Audio(this.audioListener);
    this.shotSound.setBuffer(this.shotSoundBuffer);
    this.shotSound.setLoop(false);
    this.shotSound.setVolume(0.3);
  }

  private setupInput(): void {
    Input.AddMouseDownListner((e: MouseEvent) => {
      if (e.button !== 0 || this.reloading) return;
      this.shoot = true;
      this.shootTimer = 0.0;
    });

    Input.AddMouseUpListner((e: MouseEvent) => {
      if (e.button !== 0) return;
      this.shoot = false;
    });

    Input.AddKeyDownListener((e: KeyboardEvent) => {
      if (e.repeat) return;
      if (e.code === 'KeyR') {
        this.reload();
      }
      // Number keys 1-9 for weapon switching
      if (e.code.startsWith('Digit')) {
        const num = parseInt(e.code.replace('Digit', ''), 10);
        if (num >= 1 && num <= 9 && num <= this.ownedWeapons.length) {
          this.switchWeaponByIndex(num - 1);
        }
      }
    });

    Input.AddWheelListener((e: WheelEvent) => {
      if (e.deltaY > 0) this.nextWeapon();
      else if (e.deltaY < 0) this.prevWeapon();
    });
  }

  private setAnimation(name: WeaponAnimationName, clip: THREE.AnimationClip | undefined): void {
    if (!clip || !this.mixer) {
      console.warn(`Weapon animation '${name}' not found`);
      return;
    }
    const action = this.mixer.clipAction(clip);
    this.animations[name] = { clip, action };
  }

  private setupAnimations(): void {
    if (!this.currentModel) return;

    this.mixer = new THREE.AnimationMixer(this.currentModel);
    const anims = (this.currentModel as { animations?: THREE.AnimationClip[] }).animations ?? [];

    // Clear previous animations
    this.animations = { idle: undefined, shoot: undefined, reload: undefined };

    // Index-based mapping: [shoot, idle, reload]
    this.setAnimation('shoot', anims[0]);
    this.setAnimation('idle', anims[1]);
    this.setAnimation('reload', anims[2]);
  }

  // ============================================================================
  // WEAPON SWITCHING
  // ============================================================================

  private nextWeapon(): void {
    let idx = this.currentWeaponIndex + 1;
    if (idx >= this.ownedWeapons.length) idx = 0;
    this.switchWeaponByIndex(idx);
  }

  private prevWeapon(): void {
    let idx = this.currentWeaponIndex - 1;
    if (idx < 0) idx = this.ownedWeapons.length - 1;
    this.switchWeaponByIndex(idx);
  }

  private switchWeaponByIndex(index: number): void {
    if (index === this.currentWeaponIndex && this.currentModel) return;
    this.currentWeaponIndex = index;
    this.switchWeapon(this.ownedWeapons[index]);
  }

  private saveCurrentAmmo(): void {
    this.weaponAmmo[this.currentWeaponKey] = {
      mag: this.magAmmo,
      reserve: this.ammo
    };
  }

  private applyWeaponConfig(weaponKey: WeaponKey): void {
    this.config = getWeaponConfig(weaponKey);
    this.currentWeaponKey = weaponKey;

    // Load ammo state
    const ammoState = this.weaponAmmo[weaponKey];
    this.magAmmo = ammoState.mag;
    this.ammo = ammoState.reserve;
  }

  private switchWeapon(weaponKey: WeaponKey): void {
    // Save current ammo
    this.saveCurrentAmmo();

    // Stop any current action
    this.shoot = false;
    this.reloading = false;

    // Apply new weapon config
    this.applyWeaponConfig(weaponKey);

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

      // Apply position offset
      const pos = config.positionOffset;
      this.currentModel.position.set(pos.x, pos.y, pos.z);

      // Apply rotation offset
      const rot = config.rotationOffset;
      this.currentModel.rotation.set(rot.x, rot.y, rot.z);

      // Setup shadows
      this.currentModel.traverse((child) => {
        if ((child as THREE.Mesh).isMesh) {
          child.castShadow = true;
          child.receiveShadow = true;
        }
      });

      // Add to camera
      this.camera.add(this.currentModel);

      // Setup animations for new model
      this.setupAnimations();

      // Re-attach muzzle flash to new model
      if (this.flash) {
        this.flash.position.set(0, 0, -0.5);
        this.currentModel.add(this.flash);
        // Adjust flash size/pos per weapon? Maybe handled in update
      }
    }

    // Reset state machine to idle
    if (this.stateMachine) {
      this.stateMachine.SetState('idle');
    }

    // Update UI
    if (this.uimanager) {
      this.uimanager.SetAmmo(this.magAmmo, this.ammo);
      this.uimanager.SetWeaponName(this.config.name);
      this.uimanager.SetWeaponList(this.ownedWeapons, this.currentWeaponKey);
      this.uimanager.ShowUpgradeNotification(this.config.name);
    }
  }

  // ============================================================================
  // EVENT HANDLERS
  // ============================================================================

  private onAmmoPickup = (_e: AmmoPickupEvent): void => {
    this.ammo = Math.min(this.ammo + 30, this.config.maxAmmo);
    this.uimanager?.SetAmmo(this.magAmmo, this.ammo);
  };

  private onWeaponUpgrade = (msg: WeaponUpgradeEvent): void => {
    // Disable auto-switch for upgrade, just unlock?
    // User logic: "Picking up weapon adds it".
    // This upgrade logic matches kills.
    // Let's just unlock it.
    const newTier = msg.tier;
    if (newTier < WEAPON_TIERS.length) {
      const key = WEAPON_TIERS[newTier];
      if (!this.ownedWeapons.includes(key)) {
        this.ownedWeapons.push(key);
        this.uimanager?.ShowUpgradeNotification(`Unlocked ${key}`);
      }
    }
  };

  private onWeaponPickup = (msg: WeaponPickupEvent): void => {
    const newWeaponKey = msg.weaponKey as WeaponKey;
    if (newWeaponKey) {
      if (!this.ownedWeapons.includes(newWeaponKey)) {
        this.ownedWeapons.push(newWeaponKey);
        // Switch to it?
        this.currentWeaponIndex = this.ownedWeapons.length - 1;
        this.switchWeapon(newWeaponKey);
      } else {
        // Add ammo
        const conf = WEAPONS[newWeaponKey];
        const current = this.weaponAmmo[newWeaponKey];
        current.reserve = Math.min(current.reserve + conf.magAmmo * 2, conf.maxAmmo);

        // Update UI if current
        if (this.currentWeaponKey === newWeaponKey) {
          this.ammo = current.reserve;
          this.uimanager?.SetAmmo(this.magAmmo, this.ammo);
        }
      }
    }
  };

  // ============================================================================
  // RELOAD
  // ============================================================================

  private reload(): void {
    if (this.reloading || this.magAmmo === this.config.ammoPerMag || this.ammo === 0) {
      return;
    }

    this.reloading = true;
    this.stateMachine?.SetState('reload');
  }

  /** Called by FSM when reload animation finishes */
  ReloadDone(): void {
    this.reloading = false;
    const bulletsNeeded = this.config.ammoPerMag - this.magAmmo;
    this.magAmmo = Math.min(this.ammo + this.magAmmo, this.config.ammoPerMag);
    this.ammo = Math.max(0, this.ammo - bulletsNeeded);
    this.uimanager?.SetAmmo(this.magAmmo, this.ammo);
  }

  // ============================================================================
  // SHOOTING
  // ============================================================================

  private handleShoot(deltaTime: number): void {
    if (!this.shoot) return;

    if (!this.magAmmo) {
      this.reload();
      return;
    }

    if (this.shootTimer <= 0.0) {
      // Handle nuke weapon specially
      if (this.config.type === 'projectile' && this.currentWeaponKey === 'nuke') {
        this.fireNuke();
        this.magAmmo = 0;
        this.ammo = 0;
        this.shoot = false;
        this.uimanager?.SetAmmo(this.magAmmo, this.ammo);
        return;
      }

      // Normal hitscan shooting
      const flashWithLife = this.flash as { life?: number };
      flashWithLife.life = this.config.fireRate;
      this.flash.rotateZ(Math.PI * Math.random());

      const scale = Math.random() * (1.5 - 0.8) + 0.8;
      const muzzleScale = this.config.muzzleFlashScale;
      this.flash.scale.set(scale * muzzleScale, muzzleScale, muzzleScale);

      this.shootTimer = this.config.fireRate;
      this.magAmmo = Math.max(0, this.magAmmo - 1);
      this.uimanager?.SetAmmo(this.magAmmo, this.ammo);

      // Shotgun spread
      const pellets = this.config.pellets || 1;
      const spread = this.config.spread || 0;

      for (let i = 0; i < pellets; i++) {
        this.raycast(spread);
      }

      this.Broadcast({ topic: 'weapon_shot', weapon: this.currentWeaponKey });

      if (this.shotSound) {
        if (this.shotSound.isPlaying) this.shotSound.stop();
        this.shotSound.play();
      }

      this.applyRecoil();
    }

    this.shootTimer = Math.max(0.0, this.shootTimer - deltaTime);
  }

  private raycast(spread: number = 0): void {
    try {
      const start = new THREE.Vector3(0.0, 0.0, -1.0);

      // Apply spread to start vector before unprojection?
      // No, unproject handles screen to world.
      // Spread should be applied to the direction.

      // Get forward direction
      const forward = new THREE.Vector3(0, 0, -1);
      forward.applyQuaternion(this.camera.quaternion);

      // Apply spread
      if (spread > 0) {
        const spreadX = (Math.random() - 0.5) * spread;
        const spreadY = (Math.random() - 0.5) * spread;
        const spreadZ = (Math.random() - 0.5) * spread;
        forward.x += spreadX;
        forward.y += spreadY;
        forward.z += spreadZ;
        forward.normalize();
      }

      const startPos = this.camera.position.clone();
      // start.unproject(this.camera); // This was previous logic for 2D, but we want forward

      const endPos = startPos.clone().add(forward.multiplyScalar(100)); // 100 range

      const collisionMask = CollisionFilterGroups.AllFilter;

      const hit = AmmoHelper.CastRay(this.world, startPos, endPos, this.hitResult, collisionMask);

      if (hit) {
        const collisionObj = this.hitResult.collisionObject;
        if (!collisionObj) return;

        // Look up entity from collision object registry
        const entity = AmmoHelper.GetEntityFromCollisionObject(collisionObj);

        let isLiving = false;
        if (entity && typeof entity.Broadcast === 'function') {
          const hitEvent: HitEvent = {
            topic: 'hit',
            from: this.parent!,
            amount: this.config.damage,
            hitResult: this.hitResult,
          };
          entity.Broadcast(hitEvent);
          isLiving = true;
        }

        // Create impact effect
        this.createImpactEffect(this.hitResult.intersectionPoint, isLiving);
      }
    } catch (e) {
      console.error('Weapon.raycast error:', e);
    }
  }

  private createImpactEffect(position: THREE.Vector3, isLiving: boolean): void {
    if (!this.scene) return;

    const size = isLiving ? 0.15 : 0.08;
    const color = isLiving ? 0xaa0000 : 0x8b4513;

    const geometry = new THREE.SphereGeometry(size, 8, 8);
    const material = new THREE.MeshBasicMaterial({
      color,
      transparent: true,
      opacity: 1.0,
    });
    const impact = new THREE.Mesh(geometry, material);
    impact.position.copy(position);
    impact.position.y += 0.05;
    this.scene.add(impact);

    const effectData: ImpactEffect = {
      mesh: impact,
      life: 0.5,
      maxLife: 0.5,
    };
    this.impactEffects.push(effectData);

    setTimeout(() => this.removeImpactEffect(effectData), 500);
  }

  private removeImpactEffect(effectData: ImpactEffect): void {
    if (effectData.mesh && this.scene) {
      this.scene.remove(effectData.mesh);
      effectData.mesh.geometry.dispose();
      (effectData.mesh.material as THREE.Material).dispose();
    }
    const idx = this.impactEffects.indexOf(effectData);
    if (idx > -1) {
      this.impactEffects.splice(idx, 1);
    }
  }

  private applyRecoil(): void {
    if (!this.currentModel) return;

    const originalY = this.currentModel.position.y;
    const originalZ = this.currentModel.position.z;
    this.currentModel.position.y += this.config.recoil;
    this.currentModel.position.z += this.config.recoil * 0.5;

    setTimeout(() => {
      if (this.currentModel) {
        this.currentModel.position.y = originalY;
        this.currentModel.position.z = originalZ;
      }
    }, 50);
  }

  // ============================================================================
  // NUKE WEAPON
  // ============================================================================

  private fireNuke(): void {
    const forward = new THREE.Vector3(0, 0, -1);
    forward.applyQuaternion(this.camera.quaternion);

    const startPos = (this.camera as THREE.PerspectiveCamera).position.clone();
    startPos.add(forward.clone().multiplyScalar(1.0));

    const spawnManager = this.FindEntity('SpawnManager');
    if (spawnManager) {
      spawnManager.Broadcast({
        topic: 'nuke_fired',
        startPosition: startPos,
        direction: forward,
        camera: this.camera,
      });
    }

    this.triggerNukeEffects();
  }

  private triggerNukeEffects(): void {
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

  // ============================================================================
  // MUZZLE FLASH
  // ============================================================================

  private animateMuzzle(deltaTime: number): void {
    const child = this.flash.children[0] as THREE.Mesh | undefined;
    const mat = child?.material as THREE.Material & { opacity?: number } | undefined;
    if (!mat) return;

    const flashWithLife = this.flash as { life?: number };
    const life = flashWithLife.life ?? 0;
    const ratio = life / this.config.fireRate;
    if (mat.opacity !== undefined) {
      mat.opacity = ratio;
    }
    flashWithLife.life = Math.max(0.0, life - deltaTime);
  }

  // ============================================================================
  // UPDATE
  // ============================================================================

  override Update(deltaTime: number): void {
    this.mixer?.update(deltaTime);
    this.stateMachine?.Update(deltaTime);
    this.handleShoot(deltaTime);
    this.animateMuzzle(deltaTime);
  }

  // ============================================================================
  // CLEANUP
  // ============================================================================

  override Cleanup(): void {
    // Remove impact effects
    this.impactEffects.forEach((effect) => {
      if (effect.mesh && this.scene) {
        this.scene.remove(effect.mesh);
        effect.mesh.geometry.dispose();
        (effect.mesh.material as THREE.Material).dispose();
      }
    });
    this.impactEffects = [];

    // Remove current model
    if (this.currentModel && this.camera) {
      this.camera.remove(this.currentModel);
    }
  }
}
