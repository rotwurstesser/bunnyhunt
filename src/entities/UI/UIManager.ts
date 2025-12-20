/**
 * UI Manager Component
 *
 * Controls the game HUD (ammo, health, score, weapon name).
 * Uses DOM manipulation for UI elements.
 */

import Component from '../../core/Component';

// ============================================================================
// UI MANAGER COMPONENT
// ============================================================================

export default class UIManager extends Component {
  override name = 'UIManager';

  /** Timeout for upgrade notification auto-hide */
  private upgradeTimeout: ReturnType<typeof setTimeout> | null = null;

  // ============================================================================
  // AMMO
  // ============================================================================

  /**
   * Update ammo display.
   */
  SetAmmo(mag: number, rest: number): void {
    const currentEl = document.getElementById('current_ammo');
    const maxEl = document.getElementById('max_ammo');
    if (currentEl) currentEl.innerText = String(mag);
    if (maxEl) maxEl.innerText = String(rest);
  }

  // ============================================================================
  // HEALTH
  // ============================================================================

  /**
   * Update health progress bar.
   */
  SetHealth(health: number): void {
    const el = document.getElementById('health_progress');
    if (el) el.style.width = `${health}%`;
  }

  // ============================================================================
  // SCORE
  // ============================================================================

  /**
   * Update kill score display.
   */
  SetScore(kills: number): void {
    const el = document.getElementById('score');
    if (el) el.innerText = `KILLS: ${kills}`;
  }

  // ============================================================================
  // WEAPON NAME
  // ============================================================================

  /**
   * Update current weapon name display.
   */
  SetWeaponName(name: string): void {
    const el = document.getElementById('weapon_name');
    if (el) el.innerText = name.toUpperCase();
  }

  // ============================================================================
  // UPGRADE NOTIFICATION
  // ============================================================================

  /**
   * Update weapon list display with numbered slots
   */
  SetWeaponList(owned: string[], current: string): void {
    const container = document.getElementById('weapon_list');
    if (!container) return;

    container.innerHTML = '';

    owned.forEach((w, index) => {
      const div = document.createElement('div');
      div.className = 'weapon-item';
      if (w === current) div.className += ' active';

      // Number span
      const numSpan = document.createElement('span');
      numSpan.className = 'weapon-num';
      numSpan.innerText = String(index + 1);

      // Name span
      const nameSpan = document.createElement('span');
      nameSpan.className = 'weapon-name';
      nameSpan.innerText = w.toUpperCase();

      div.appendChild(numSpan);
      div.appendChild(nameSpan);
      container.appendChild(div);
    });
  }

  /**
   * Show weapon upgrade notification.
   * Auto-hides after 3 seconds.
   */
  ShowUpgradeNotification(weaponName: string): void {
    const el = document.getElementById('upgrade_notification');
    const nameEl = document.getElementById('upgrade_weapon_name');

    if (!el) return;

    if (nameEl) nameEl.innerText = weaponName;

    el.classList.remove('hidden');
    el.classList.add('animate-in');

    // Clear any existing timeout
    if (this.upgradeTimeout) {
      clearTimeout(this.upgradeTimeout);
    }

    this.upgradeTimeout = setTimeout(() => {
      el.classList.add('hidden');
      el.classList.remove('animate-in');
    }, 3000);
  }

  // ============================================================================
  // INITIALIZATION
  // ============================================================================

  override Initialize(): void {
    const hud = document.getElementById('game_hud');
    if (hud) hud.style.visibility = 'visible';
  }

  // ============================================================================
  // CLEANUP
  // ============================================================================

  override Cleanup(): void {
    if (this.upgradeTimeout) {
      clearTimeout(this.upgradeTimeout);
      this.upgradeTimeout = null;
    }
  }
}
