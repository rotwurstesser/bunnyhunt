/**
 * Game Manager Component
 *
 * Tracks game progression, kill count, and weapon tier upgrades.
 */

import Component from '../../core/Component';
import type { AnimalKilledEvent, WeaponUpgradeEvent } from '../../types/events.types';
import type { IEntity } from '../../types/entity.types';

// ============================================================================
// TYPES
// ============================================================================

/** UI Manager interface */
interface UIManagerComponent {
  SetScore(kills: number): void;
  SetWeaponName(name: string): void;
  ShowUpgradeNotification(weaponName: string): void;
}

// ============================================================================
// GAME MANAGER COMPONENT
// ============================================================================

export default class GameManager extends Component {
  override name = 'GameManager';

  // ============================================================================
  // STATE
  // ============================================================================

  /** Total kills */
  private kills: number = 0;

  /** Current weapon tier (0-3) */
  private currentWeaponTier: number = 0;

  /** Kill thresholds for weapon tiers */
  private readonly weaponThresholds: readonly number[] = [0, 15, 30, 50];

  /** Weapon names for each tier */
  private readonly weaponNames: readonly string[] = ['Hunting Rifle', 'AK-47', 'Gatling Gun', 'NUKE'];

  // ============================================================================
  // REFERENCES
  // ============================================================================

  private uimanager: UIManagerComponent | null = null;
  private player: IEntity | null = null;

  // ============================================================================
  // INITIALIZATION
  // ============================================================================

  override Initialize(): void {
    const uiEntity = this.FindEntity('UIManager');
    this.uimanager = uiEntity?.GetComponent('UIManager') as UIManagerComponent | undefined ?? null;
    this.player = this.FindEntity('Player') ?? null;

    // Listen for animal kills
    this.parent!.RegisterEventHandler(this.onAnimalKilled, 'animal_killed');

    // Initial UI update
    if (this.uimanager) {
      this.uimanager.SetScore(this.kills);
      this.uimanager.SetWeaponName(this.weaponNames[0]);
    }
  }

  // ============================================================================
  // EVENT HANDLERS
  // ============================================================================

  private onAnimalKilled = (_msg: AnimalKilledEvent): void => {
    this.kills++;
    this.uimanager?.SetScore(this.kills);
    this.checkWeaponUpgrade();
  };

  // ============================================================================
  // WEAPON PROGRESSION
  // ============================================================================

  private checkWeaponUpgrade(): void {
    // Find the highest tier we qualify for
    let newTier = 0;
    for (let i = this.weaponThresholds.length - 1; i >= 0; i--) {
      if (this.kills >= this.weaponThresholds[i]) {
        newTier = i;
        break;
      }
    }

    if (newTier > this.currentWeaponTier) {
      this.currentWeaponTier = newTier;
      const weaponName = this.weaponNames[newTier];

      // Notify player about weapon upgrade
      if (this.player) {
        const upgradeEvent: WeaponUpgradeEvent = {
          topic: 'weapon_upgrade',
          tier: newTier,
          weaponName: weaponName,
        };
        this.player.Broadcast(upgradeEvent);
      }

      // Show upgrade notification in UI
      if (this.uimanager) {
        this.uimanager.ShowUpgradeNotification(weaponName);
        this.uimanager.SetWeaponName(weaponName);
      }
    }
  }

  // ============================================================================
  // ACCESSORS
  // ============================================================================

  /**
   * Get current kill count.
   */
  GetKills(): number {
    return this.kills;
  }

  /**
   * Get current weapon tier.
   */
  GetCurrentWeaponTier(): number {
    return this.currentWeaponTier;
  }
}
