/**
 * Component Base Class
 *
 * Base class for all entity components.
 * Components are attached to entities and provide specific functionality.
 */

import type { IComponent, IEntity, ComponentName } from '../types/entity.types';
import type { GameEvent } from '../types/events.types';

export class Component implements IComponent {
  /**
   * Component name - used for registry lookup.
   * Subclasses should override this with their specific name.
   */
  name: ComponentName = 'Component';

  /**
   * Parent entity reference.
   * Set when component is added to an entity.
   */
  parent: IEntity | null = null;

  /**
   * Set the parent entity.
   * Called automatically by Entity.AddComponent.
   */
  SetParent(parent: IEntity): void {
    this.parent = parent;
  }

  /**
   * Initialize the component.
   * Called after the entity is added to the entity manager.
   * Override in subclasses to set up references, create objects, etc.
   */
  Initialize(): void {
    // Override in subclass
  }

  /**
   * Get another component from the parent entity.
   *
   * @param name - The component name to look up
   * @returns The component if found, undefined otherwise
   */
  GetComponent<K extends ComponentName>(name: K): IComponent | undefined {
    return this.parent?.GetComponent(name);
  }

  /**
   * Find an entity by name through the entity manager.
   *
   * @param name - The entity name to find
   * @returns The entity if found, undefined otherwise
   */
  FindEntity(name: string): IEntity | undefined {
    return this.parent?.FindEntity(name);
  }

  /**
   * Broadcast an event through the parent entity.
   *
   * @param msg - The event to broadcast
   */
  Broadcast(msg: GameEvent): void {
    this.parent?.Broadcast(msg);
  }

  /**
   * Update the component each frame.
   * Override in subclasses to implement per-frame logic.
   *
   * @param deltaTime - Time elapsed since last frame in seconds
   */
  Update(_deltaTime: number): void {
    // Override in subclass
  }

  /**
   * Physics update callback.
   * Called during physics step for physics-related updates.
   *
   * @param _world - The physics world
   * @param _timeStep - Physics time step
   */
  PhysicsUpdate(_world: unknown, _timeStep: number): void {
    // Override in subclass
  }

  /**
   * Cleanup resources when the entity is removed.
   * Override in subclasses to dispose of Three.js objects, physics bodies, etc.
   */
  Cleanup(): void {
    // Override in subclass
  }
}

// Also export as default for backwards compatibility
export default Component;
