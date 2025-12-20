/**
 * Entity Class
 *
 * Base class for all game entities.
 * Entities are containers for components and provide position, rotation,
 * and event handling.
 */

import { Vector3, Quaternion } from 'three';
import type {
  IEntity,
  IEntityManager,
  IComponent,
  ComponentName,
} from '../types/entity.types';
import type { GameEvent, EventTopic, EventHandler } from '../types/events.types';

export class Entity implements IEntity {
  /** Unique entity ID (set by EntityManager) */
  id: number = 0;

  /** Entity name */
  private _name: string | null = null;

  /** Component storage */
  components: Record<string, IComponent> = {};

  /** World position */
  private _position: Vector3 = new Vector3();

  /** World rotation */
  private _rotation: Quaternion = new Quaternion();

  /** Parent entity manager */
  parent: IEntityManager | null = null;

  /** Event handlers by topic */
  private eventHandlers: Map<EventTopic, Array<EventHandler<EventTopic>>> =
    new Map();

  /** Whether entity is active (updated each frame) */
  active: boolean = true;

  get name(): string | null {
    return this._name;
  }

  get Name(): string | null {
    return this._name;
  }

  get position(): Vector3 {
    return this._position;
  }

  get Position(): Vector3 {
    return this._position;
  }

  get rotation(): Quaternion {
    return this._rotation;
  }

  get Rotation(): Quaternion {
    return this._rotation;
  }

  /**
   * Add a component to this entity.
   */
  AddComponent(component: IComponent): void {
    component.SetParent(this);
    this.components[component.name] = component;
  }

  /**
   * Set the parent entity manager.
   */
  SetParent(parent: IEntityManager): void {
    this.parent = parent;
  }

  /**
   * Set the entity name.
   */
  SetName(name: string | number): void {
    this._name = String(name);
  }

  /**
   * Get a component by name.
   */
  GetComponent<K extends ComponentName>(name: K): IComponent | undefined {
    return this.components[name];
  }

  /**
   * Set entity position.
   */
  SetPosition(position: Vector3): void {
    this._position.copy(position);
  }

  /**
   * Set entity rotation.
   */
  SetRotation(rotation: Quaternion): void {
    this._rotation.copy(rotation);
  }

  /**
   * Find another entity by name through the entity manager.
   */
  FindEntity(name: string): Entity | undefined {
    return this.parent?.Get(name) as Entity | undefined;
  }

  /**
   * Register an event handler for a specific topic.
   */
  RegisterEventHandler<T extends GameEvent>(
    handler: (msg: T) => void,
    topic: T['topic']
  ): void {
    if (!this.eventHandlers.has(topic)) {
      this.eventHandlers.set(topic, []);
    }
    this.eventHandlers.get(topic)!.push(handler as EventHandler<EventTopic>);
  }

  /**
   * Broadcast an event to all registered handlers.
   */
  Broadcast(msg: GameEvent): void {
    const handlers = this.eventHandlers.get(msg.topic);
    if (!handlers) return;

    for (const handler of handlers) {
      handler(msg);
    }
  }

  /**
   * Physics update - called during physics step.
   */
  PhysicsUpdate(world: unknown, timeStep: number): void {
    for (const key in this.components) {
      this.components[key].PhysicsUpdate(world, timeStep);
    }
  }

  /**
   * Update all components.
   */
  Update(deltaTime: number): void {
    for (const key in this.components) {
      this.components[key].Update(deltaTime);
    }
  }

  /**
   * Cleanup all components.
   */
  Cleanup(): void {
    for (const key in this.components) {
      this.components[key].Cleanup?.();
    }
  }
}

// Also export as default for backwards compatibility
export default Entity;
