/**
 * Animal Controller Base Class
 *
 * Abstract base class for all animal controllers (Rabbit, Fox, Mutant).
 * Eliminates ~80% code duplication by providing shared functionality:
 * - Animation handling via AnimationController
 * - FSM-based state management
 * - Navigation and path following
 * - Collision detection
 * - Health and damage handling
 * - Blood pool effects
 * - Cleanup lifecycle
 *
 * Subclasses only need to implement:
 * - getAnimalConfig() - Entity stats
 * - getAnimationConfig() - Animation mappings
 * - getBehaviorConfig() - AI behavior settings
 * - createStateMachine() - State machine setup
 * - getInitialState() - Starting state
 * - getDeadState() - Death state name
 * - handleHitWhileAlive() - Reaction to damage
 */

import * as THREE from 'three';
import Component from '../../core/Component';
import { Entity } from '../../core/Entity';
import { FiniteStateMachine, type IState } from '../../core/FiniteStateMachine';
import { AnimationController } from '../../systems/AnimationController';
import { AmmoHelper, Ammo, CollisionFilterGroups } from '../../core/AmmoLib';
import type { IEntity, AnimalConfig, BehaviorConfig } from '../../types/entity.types';
import type {
  EntityAnimationConfig,
  AnimationActionName,
} from '../../types/animation.types';
import type { HitEvent } from '../../types/events.types';
import HealthBar from '../UI/HealthBar';
import DamageText from '../UI/DamageText';

// Forward declare these types - they'll be properly typed when those files are migrated
interface NavmeshComponent {
  GetRandomNode(position: THREE.Vector3, radius: number): THREE.Vector3 | null;
  FindPath(from: THREE.Vector3, to: THREE.Vector3): THREE.Vector3[] | null;
}

interface HealthBarComponent {
  container: { visible: boolean };
  Initialize(): void;
}

/**
 * Abstract base class for all animal controllers.
 *
 * @template TState - Union type of valid state names for this animal
 */
export abstract class AnimalController<TState extends string> extends Component {
  // ============================================================================
  // CORE REFERENCES
  // ============================================================================

  /** The 3D model */
  protected model: THREE.Object3D;

  /** Three.js scene reference */
  protected scene: THREE.Scene;

  /** Ammo.js physics world */
  protected physicsWorld: unknown;

  // ============================================================================
  // SYSTEMS
  // ============================================================================

  /** Animation controller */
  public animationController: AnimationController;

  /** State machine for AI behavior */
  protected stateMachine!: FiniteStateMachine<TState, this>;

  // ============================================================================
  // STATE
  // ============================================================================

  /** Current navigation path */
  public path: THREE.Vector3[] = [];

  /** Physics ghost object for collision */
  protected ghostObj: unknown | null = null;

  /** Navmesh reference for pathfinding */
  protected navmesh: NavmeshComponent | null = null;

  /** Player entity reference */
  protected player: IEntity | null = null;

  /** Whether Initialize has been called */
  protected initialized: boolean = false;

  /** Blood pool mesh (created on death) */
  protected bloodPool: THREE.Mesh | null = null;

  // ============================================================================
  // HEALTH
  // ============================================================================

  /** Current health */
  public health: number;

  /** Maximum health */
  public maxHealth: number;

  /** Whether the animal is dead */
  public isDead: boolean = false;

  // ============================================================================
  // TEMP OBJECTS (reused for performance)
  // ============================================================================

  protected readonly tempRot = new THREE.Quaternion();
  protected readonly forwardVec = new THREE.Vector3(0, 0, 1);
  protected readonly tempVec = new THREE.Vector3();

  // ============================================================================
  // CONSTRUCTOR
  // ============================================================================

  constructor(
    model: THREE.Object3D,
    scene: THREE.Scene,
    physicsWorld: unknown
  ) {
    super();

    this.model = model;
    this.scene = scene;
    this.physicsWorld = physicsWorld;

    // Initialize from config
    const config = this.getAnimalConfig();
    this.name = config.name;
    this.health = config.health;
    this.maxHealth = config.maxHealth;

    // Create animation controller
    this.animationController = new AnimationController(this.getAnimationConfig());
  }

  // ============================================================================
  // ABSTRACT METHODS - Subclasses MUST implement
  // ============================================================================

  /** Get the animal configuration (health, speed, etc.) */
  protected abstract getAnimalConfig(): AnimalConfig;

  /** Get the animation configuration (clip matchers, fallbacks) */
  protected abstract getAnimationConfig(): EntityAnimationConfig;

  /** Get the behavior configuration (flee distance, attack range, etc.) */
  protected abstract getBehaviorConfig(): BehaviorConfig;

  /** Create and configure the state machine */
  protected abstract createStateMachine(): FiniteStateMachine<TState, this>;

  /** Get the initial state to enter after initialization */
  protected abstract getInitialState(): TState;

  /** Get the dead state name */
  protected abstract getDeadState(): TState;

  /** Handle being hit while still alive (flee, chase, etc.) */
  protected abstract handleHitWhileAlive(): void;

  // ============================================================================
  // INITIALIZATION
  // ============================================================================

  /**
   * Initialize the animal controller.
   * Template method pattern - calls hooks that subclasses can override.
   */
  override Initialize(): void {
    if (this.initialized) return;
    this.initialized = true;

    const config = this.getAnimalConfig();

    // Get references
    const level = this.FindEntity('Level');
    this.navmesh = level?.GetComponent('Navmesh') as NavmeshComponent | undefined ?? null;
    this.player = this.FindEntity('Player') ?? null;

    // Register for hit events
    this.parent!.RegisterEventHandler(this.TakeHit, 'hit');

    // Setup model
    this.model.scale.setScalar(config.baseScale);
    this.model.position.copy(this.parent!.position);

    // Setup animations - call appropriate method based on source
    this.setupAnimations();

    // Setup materials and shadows
    this.setupMaterials();

    // Add to scene
    this.scene.add(this.model);

    // Create physics collider
    this.createCollider();

    // Create health bar - dynamically import to avoid circular deps
    this.createHealthBar();

    // Create and start state machine
    this.stateMachine = this.createStateMachine();
    this.stateMachine.SetState(this.getInitialState());

    // Hook for subclass initialization
    this.onInitialize();
  }

  /**
   * Setup animations based on config source.
   * Override in subclasses for custom animation loading.
   */
  protected setupAnimations(): void {
    const config = this.getAnimationConfig();

    if (config.source === 'gltf-embedded') {
      this.animationController.setupFromModel(this.model);
    }
    // FBX and index-based sources should override this method
  }

  /**
   * Setup materials - clone materials and enable shadows.
   */
  protected setupMaterials(): void {
    this.model.traverse((child) => {
      if ((child as THREE.Mesh).isMesh) {
        const mesh = child as THREE.Mesh;
        mesh.castShadow = true;
        mesh.receiveShadow = true;

        // Clone material to prevent shared state issues (e.g., red flash affecting all instances)
        if (mesh.material) {
          if (Array.isArray(mesh.material)) {
            mesh.material = mesh.material.map((m) => m.clone());
          } else {
            mesh.material = mesh.material.clone();
          }
        }
      }
    });
  }

  /**
   * Create physics collider.
   */
  protected createCollider(): void {
    const config = this.getAnimalConfig();
    const shape = new Ammo.btSphereShape(config.colliderRadius);
    this.ghostObj = AmmoHelper.CreateTrigger(shape);
    AmmoHelper.RegisterCollisionEntity(this.ghostObj, this.parent!);

    const world = this.physicsWorld as {
      addCollisionObject(obj: unknown, group: number, mask: number): void;
    };
    world.addCollisionObject(
      this.ghostObj,
      CollisionFilterGroups.SensorTrigger,
      CollisionFilterGroups.AllFilter
    );

    this.updateColliderPosition();
  }

  /**
   * Create health bar component.
   */
  protected createHealthBar(): void {
    const healthBar = new HealthBar(this.scene, this);
    this.parent!.AddComponent(healthBar);
    healthBar.Initialize();
  }

  /**
   * Hook for subclass initialization.
   * Called at the end of Initialize().
   */
  protected onInitialize(): void {
    // Override in subclass if needed
  }

  // ============================================================================
  // ANIMATION
  // ============================================================================

  /**
   * Play an animation by name.
   * Used by FSM states.
   */
  playAnimation(name: AnimationActionName, loop: boolean = true): void {
    this.animationController.play(name, { loop, clampWhenFinished: !loop });
  }

  // ============================================================================
  // NAVIGATION
  // ============================================================================

  /**
   * Navigate to a random point within radius.
   */
  navigateToRandomPoint(radius: number = 20): void {
    if (!this.navmesh) return;

    const node = this.navmesh.GetRandomNode(this.model.position, radius);
    if (node) {
      this.path = this.navmesh.FindPath(this.model.position, node) || [];
    }
  }

  /**
   * Clear the current navigation path.
   */
  clearPath(): void {
    this.path = [];
  }

  /**
   * Move along the current path.
   */
  moveAlongPath(deltaTime: number): void {
    if (!this.path.length || this.isDead) return;

    const target = this.path[0].clone().sub(this.model.position);
    target.y = 0;

    if (target.lengthSq() > 0.09) { // 0.3 * 0.3
      target.normalize();

      // Rotate to face movement direction
      this.tempRot.setFromUnitVectors(this.forwardVec, target);
      this.model.quaternion.slerp(this.tempRot, 6.0 * deltaTime);

      // Move forward
      const speed = this.getMoveSpeed();
      this.model.position.add(target.multiplyScalar(speed * deltaTime));
    } else {
      // Reached waypoint
      this.path.shift();
    }
  }

  /**
   * Get current movement speed.
   * Override to modify based on state (e.g., chase speed).
   */
  protected getMoveSpeed(): number {
    return this.getAnimalConfig().speed;
  }

  // ============================================================================
  // COLLISION
  // ============================================================================

  /**
   * Update collider position to match model.
   */
  protected updateColliderPosition(): void {
    if (!this.ghostObj) return;

    const config = this.getAnimalConfig();
    const ghost = this.ghostObj as {
      getWorldTransform(): { getOrigin(): { setValue(x: number, y: number, z: number): void } };
    };
    const transform = ghost.getWorldTransform();
    const pos = this.model.position;
    transform.getOrigin().setValue(pos.x, pos.y + config.colliderYOffset, pos.z);
  }

  // ============================================================================
  // DAMAGE HANDLING
  // ============================================================================

  /**
   * Handle being hit.
   * Arrow function to preserve 'this' when used as event handler.
   */
  TakeHit = (msg: HitEvent): void => {
    if (this.isDead) return;

    this.health = Math.max(0, this.health - msg.amount);
    this.showDamageEffects(msg.amount);

    if (this.health <= 0) {
      this.handleDeath();
    } else {
      this.handleHitWhileAlive();
    }
  };

  /**
   * Handle death.
   */
  protected handleDeath(): void {
    this.isDead = true;
    this.notifyManagers();
    this.stateMachine.SetState(this.getDeadState());
  }

  /**
   * Notify game managers about death.
   */
  protected notifyManagers(): void {
    const config = this.getAnimalConfig();

    // Notify GameManager
    const gameManager = this.FindEntity('GameManager');
    if (gameManager) {
      gameManager.Broadcast({
        topic: 'animal_killed',
        entity: this.parent!,
        type: config.animalType as 'rabbit' | 'fox' | 'mutant',
      });
    }

    // Notify SpawnManager
    const spawnManager = this.FindEntity('SpawnManager');
    if (spawnManager) {
      spawnManager.Broadcast({
        topic: 'animal_died',
        entity: this.parent!,
        type: config.animalType as 'rabbit' | 'fox' | 'mutant',
        position: this.model.position.clone(),
      });
    }
  }

  /**
   * Show damage visual effects.
   */
  protected showDamageEffects(amount: number): void {
    // Show damage text
    const textEntity = new Entity();
    textEntity.SetPosition(this.model.position);
    const damageText = new DamageText(new THREE.Vector3(0, 0, 0), amount, this.scene); // Position relative to entity
    textEntity.AddComponent(damageText);

    // Add to manager via parent's manager
    if (this.parent && this.parent.parent) {
      this.parent.parent.Add(textEntity);
    } else {
      // Fallback or error
      damageText.Initialize(); // Force init but it won't update
    }

    // Flash red
    this.model.traverse((child) => {
      if ((child as THREE.Mesh).isMesh) {
        const mesh = child as THREE.Mesh;
        const material = mesh.material as THREE.MeshStandardMaterial;
        if (material?.color) {
          const oldColor = material.color.getHex();
          material.color.setHex(0xff0000);
          setTimeout(() => {
            if (material?.color) {
              material.color.setHex(oldColor);
            }
          }, 100);
        }
      }
    });
  }

  /**
   * Called when entering dead state.
   * Removes physics collider.
   */
  onDeath(): void {
    if (this.ghostObj && this.physicsWorld) {
      try {
        AmmoHelper.UnregisterCollisionEntity(this.ghostObj);
        const world = this.physicsWorld as {
          removeCollisionObject?(obj: unknown): void;
          getWorld?(): { removeCollisionObject(obj: unknown): void };
        };
        if (typeof world.removeCollisionObject === 'function') {
          world.removeCollisionObject(this.ghostObj);
        } else if (typeof world.getWorld === 'function') {
          world.getWorld().removeCollisionObject(this.ghostObj);
        }
      } catch (e) {
        console.warn('Failed to remove collision object:', e);
      }
      this.ghostObj = null;
    }
  }

  /**
   * Create blood pool effect at current position.
   */
  createBloodPool(): void {
    const geometry = new THREE.CircleGeometry(1.2, 32);
    const material = new THREE.MeshBasicMaterial({
      color: 0x8b0000,
      transparent: true,
      opacity: 0.9,
      side: THREE.DoubleSide,
    });
    const bloodPool = new THREE.Mesh(geometry, material);
    bloodPool.rotation.x = -Math.PI / 2;
    bloodPool.position.copy(this.model.position);
    bloodPool.position.y = 0.02;
    this.scene.add(bloodPool);
    this.bloodPool = bloodPool;
  }

  // ============================================================================
  // UPDATE
  // ============================================================================

  /**
   * Update the controller each frame.
   */
  override Update(deltaTime: number): void {
    if (!this.initialized) return;

    // Update animations
    this.animationController.update(deltaTime);

    if (this.isDead) {
      // Just update death animation
      this.stateMachine?.Update(deltaTime);
      return;
    }

    // Move along path
    this.moveAlongPath(deltaTime);

    // Update FSM
    this.stateMachine?.Update(deltaTime);

    // Update collider
    this.updateColliderPosition();

    // Sync entity position
    this.parent!.SetPosition(this.model.position);
    this.parent!.SetRotation(this.model.quaternion);
  }

  // ============================================================================
  // CLEANUP
  // ============================================================================

  /**
   * Cleanup resources when entity is removed.
   */
  override Cleanup(): void {
    // Remove physics
    if (this.ghostObj && this.physicsWorld) {
      try {
        AmmoHelper.UnregisterCollisionEntity(this.ghostObj);
        const world = this.physicsWorld as {
          removeCollisionObject?(obj: unknown): void;
        };
        if (typeof world.removeCollisionObject === 'function') {
          world.removeCollisionObject(this.ghostObj);
        }
      } catch (e) {
        // Ignore cleanup errors
      }
      this.ghostObj = null;
    }

    // Remove blood pool
    if (this.bloodPool && this.scene) {
      this.scene.remove(this.bloodPool);
      this.bloodPool.geometry.dispose();
      (this.bloodPool.material as THREE.Material).dispose();
      this.bloodPool = null;
    }

    // Remove model
    if (this.model && this.scene) {
      this.scene.remove(this.model);
    }

    // Dispose animation controller
    this.animationController.dispose();
  }
}
