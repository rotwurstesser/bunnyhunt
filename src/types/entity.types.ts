/**
 * Entity System Type Definitions
 *
 * Provides type-safe component access and entity management.
 */

import type * as THREE from 'three';
import type { GameEvent } from './events.types';

// Forward declare component types - will be updated as components are migrated
// This allows components to be added incrementally during migration
export interface ComponentRegistry {
  // Core
  // Phase 4-6 will add these:
  // 'RabbitController': RabbitController;
  // 'FoxController': FoxController;
  // 'CharacterController': CharacterController;
  // etc.

  // Using string index signature for migration compatibility
  [key: string]: IComponent;
}

/**
 * Component name type - keys of the component registry.
 * During migration, this will be gradually typed as components are added.
 */
export type ComponentName = keyof ComponentRegistry | string;

/**
 * Entity interface - represents a game entity with components.
 */
export interface IEntity {
  /** Unique entity ID */
  readonly id: number;

  /** Entity name (can be null for auto-generated names) */
  readonly name: string | null;

  /** Current world position */
  readonly position: THREE.Vector3;

  /** Current world rotation */
  readonly rotation: THREE.Quaternion;

  /** Parent entity manager */
  readonly parent: IEntityManager | null;

  /** Whether entity is active (updated each frame) */
  active: boolean;

  /**
   * Get a component by name with type inference.
   * Returns undefined if component not found.
   */
  GetComponent<K extends ComponentName>(name: K): ComponentRegistry[K] | undefined;

  /**
   * Add a component to this entity.
   */
  AddComponent(component: IComponent): void;

  /**
   * Set entity position.
   */
  SetPosition(position: THREE.Vector3): void;

  /**
   * Set entity rotation.
   */
  SetRotation(rotation: THREE.Quaternion): void;

  /**
   * Set entity name.
   */
  SetName(name: string | number): void;

  /**
   * Register an event handler for a specific topic.
   */
  RegisterEventHandler<T extends GameEvent>(
    handler: (msg: T) => void,
    topic: T['topic']
  ): void;

  /**
   * Broadcast an event to all registered handlers.
   */
  Broadcast(msg: GameEvent): void;

  /**
   * Find another entity by name.
   */
  FindEntity(name: string): IEntity | undefined;

  /**
   * Update all components.
   */
  Update(deltaTime: number): void;

  /**
   * Physics update for all components.
   */
  PhysicsUpdate(world: unknown, timeStep: number): void;
}

/**
 * Component interface - base for all entity components.
 */
export interface IComponent {
  /** Component name for registry lookup */
  readonly name: ComponentName;

  /** Parent entity reference */
  parent: IEntity | null;

  /**
   * Set the parent entity. Called by Entity.AddComponent.
   */
  SetParent(parent: IEntity): void;

  /**
   * Initialize the component. Called after entity is added to manager.
   */
  Initialize(): void;

  /**
   * Update the component each frame.
   */
  Update(deltaTime: number): void;

  /**
   * Physics update callback.
   */
  PhysicsUpdate(world: unknown, timeStep: number): void;

  /**
   * Get another component from the parent entity.
   */
  GetComponent<K extends ComponentName>(name: K): ComponentRegistry[K] | undefined;

  /**
   * Find an entity by name through the parent.
   */
  FindEntity(name: string): IEntity | undefined;

  /**
   * Broadcast an event through the parent entity.
   */
  Broadcast(msg: GameEvent): void;

  /**
   * Cleanup resources when entity is removed.
   */
  Cleanup?(): void;
}

/**
 * Entity manager interface.
 */
export interface IEntityManager {
  /**
   * Get an entity by name.
   */
  Get(name: string): IEntity | undefined;

  /**
   * Add an entity to the manager.
   */
  Add(entity: IEntity): void;

  /**
   * Remove an entity from the manager.
   */
  Remove(entity: IEntity): void;

  /**
   * Get all entities.
   */
  GetAll(): IEntity[];

  /**
   * Called after all entities are set up to initialize components.
   */
  EndSetup(): void;

  /**
   * Update all entities.
   */
  Update(deltaTime: number): void;

  /**
   * Physics update all entities.
   */
  PhysicsUpdate(world: unknown, timeStep: number): void;
}

/**
 * Animal configuration interface.
 */
export interface AnimalConfig {
  /** Controller component name */
  readonly name: string;

  /** Animal type identifier */
  readonly animalType: string;

  /** Starting health */
  readonly health: number;

  /** Maximum health */
  readonly maxHealth: number;

  /** Movement speed in units/second */
  readonly speed: number;

  /** Base scale for the model */
  readonly baseScale: number;

  /** Collision sphere radius */
  readonly colliderRadius: number;

  /** Y offset for collider position */
  readonly colliderYOffset: number;

  /** Y offset for health bar (optional, defaults to 1.8) */
  readonly healthBarYOffset?: number;

  /** Scale for health bar (optional, defaults to 1.0) */
  readonly healthBarScale?: number;
}

/**
 * Behavior configuration for animals.
 */
export interface BehaviorConfig {
  /** Behavior type */
  readonly type: 'prey' | 'predator';

  /** Distance at which prey starts fleeing */
  readonly fleeDistance?: number;

  /** Distance at which predator can see player */
  readonly viewDistance?: number;

  /** Distance at which predator can attack */
  readonly attackDistance?: number;

  /** Damage dealt per attack */
  readonly attackDamage?: number;

  /** Speed when chasing */
  readonly chaseSpeed?: number;
}
