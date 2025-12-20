/**
 * Player Health Component
 *
 * Tracks player health and handles damage events.
 */

import Component from '../../core/Component';
import type { HitEvent } from '../../types/events.types';

// ============================================================================
// TYPES
// ============================================================================

/** UI Manager interface */
interface UIManagerComponent {
  SetHealth(health: number): void;
}

// ============================================================================
// PLAYER HEALTH COMPONENT
// ============================================================================

export default class PlayerHealth extends Component {
  override name = 'PlayerHealth';

  // ============================================================================
  // STATE
  // ============================================================================

  /** Current health */
  private health: number = 100;

  /** Maximum health */
  private readonly maxHealth: number = 100;

  /** UI manager reference */
  private uimanager: UIManagerComponent | null = null;

  // ============================================================================
  // INITIALIZATION
  // ============================================================================

  override Initialize(): void {
    // Get UI manager
    const uiEntity = this.FindEntity('UIManager');
    this.uimanager = uiEntity?.GetComponent('UIManager') as UIManagerComponent | undefined ?? null;

    // Register hit event handler
    this.parent!.RegisterEventHandler(this.takeHit, 'hit');

    // Set initial health display
    this.uimanager?.SetHealth(this.health);
  }

  // ============================================================================
  // DAMAGE HANDLING
  // ============================================================================

  /**
   * Handle being hit.
   * Arrow function to preserve 'this' when used as event handler.
   */
  private takeHit = (_e: HitEvent): void => {
    // Take fixed damage per hit
    this.health = Math.max(0, this.health - 10);
    this.uimanager?.SetHealth(this.health);

    // Could add death handling here if health <= 0
    if (this.health <= 0) {
      this.handleDeath();
    }
  };

  private handleDeath(): void {
    // Broadcast death event
    this.parent?.Broadcast({ topic: 'player_died' });
  }

  // ============================================================================
  // ACCESSORS
  // ============================================================================

  /** Get current health */
  getHealth(): number {
    return this.health;
  }

  /** Get max health */
  getMaxHealth(): number {
    return this.maxHealth;
  }

  /** Check if alive */
  isAlive(): boolean {
    return this.health > 0;
  }

  /** Heal the player */
  heal(amount: number): void {
    this.health = Math.min(this.maxHealth, this.health + amount);
    this.uimanager?.SetHealth(this.health);
  }

  /** Set health directly */
  setHealth(health: number): void {
    this.health = Math.max(0, Math.min(this.maxHealth, health));
    this.uimanager?.SetHealth(this.health);
  }
}
