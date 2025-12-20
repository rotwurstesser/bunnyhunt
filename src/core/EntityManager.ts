/**
 * Entity Manager
 *
 * Manages the lifecycle of all game entities.
 * Handles entity registration, updates, and removal.
 */

import type { IEntity, IEntityManager } from '../types/entity.types';

export class EntityManager implements IEntityManager {
  /** Counter for generating unique entity IDs */
  private ids: number = 0;

  /** All managed entities */
  private entities: IEntity[] = [];

  /**
   * Get an entity by name.
   */
  Get(name: string): IEntity | undefined {
    return this.entities.find((entity) => entity.name === name);
  }

  /**
   * Add an entity to the manager.
   * Assigns an ID and sets the parent reference.
   */
  Add(entity: IEntity): void {
    // Auto-generate name if not set
    if (!entity.name) {
      (entity as { SetName: (n: number) => void }).SetName(this.ids);
    }

    // Assign ID
    (entity as { id: number }).id = this.ids;
    this.ids++;

    // Set parent reference
    (entity as { SetParent: (p: IEntityManager) => void }).SetParent(this);

    this.entities.push(entity);
  }

  /**
   * Called after all entities are set up.
   * Initializes all components on all entities.
   */
  EndSetup(): void {
    for (const entity of this.entities) {
      const components = (entity as { components: Record<string, { Initialize: () => void }> }).components;
      for (const key in components) {
        components[key].Initialize();
      }
    }
  }

  /**
   * Physics update all entities.
   */
  PhysicsUpdate(world: unknown, timeStep: number): void {
    for (const entity of this.entities) {
      entity.PhysicsUpdate(world, timeStep);
    }
  }

  /**
   * Update all active entities.
   */
  Update(deltaTime: number): void {
    for (const entity of this.entities) {
      if (entity.active !== false) {
        entity.Update(deltaTime);
      }
    }
  }

  /**
   * Remove an entity from the manager.
   */
  Remove(entity: IEntity): void {
    const idx = this.entities.indexOf(entity);
    if (idx > -1) {
      // Cleanup entity before removal
      (entity as { Cleanup?: () => void }).Cleanup?.();
      this.entities.splice(idx, 1);
    }
  }

  /**
   * Get all entities.
   */
  GetAll(): IEntity[] {
    return this.entities;
  }

  /**
   * Get entities by a filter function.
   */
  Filter(predicate: (entity: IEntity) => boolean): IEntity[] {
    return this.entities.filter(predicate);
  }

  /**
   * Get entity count.
   */
  get count(): number {
    return this.entities.length;
  }
}

// Also export as default for backwards compatibility
export default EntityManager;
