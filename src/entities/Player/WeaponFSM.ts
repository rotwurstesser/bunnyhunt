/**
 * Weapon Finite State Machine
 *
 * Handles weapon state transitions: idle, shoot, reload.
 * Uses the same FSM pattern as animal controllers.
 */

import * as THREE from 'three';
import { FiniteStateMachine, State, type IState } from '../../core/FiniteStateMachine';
import type { WeaponAnimationName } from '../../config/weapons.config';

// ============================================================================
// TYPES
// ============================================================================

/** Weapon state names */
export type WeaponState = 'idle' | 'shoot' | 'reload';

/** Animation reference stored on weapon */
export interface WeaponAnimation {
  clip: THREE.AnimationClip;
  action: THREE.AnimationAction;
}

/** Weapon proxy interface - what the FSM expects from the weapon component */
export interface WeaponProxy {
  /** Current animations map */
  animations: Record<WeaponAnimationName, WeaponAnimation | undefined>;

  /** Animation mixer */
  mixer: THREE.AnimationMixer | null;

  /** Whether shooting is active */
  shoot: boolean;

  /** Current magazine ammo */
  magAmmo: number;

  /** Called when reload animation finishes */
  ReloadDone(): void;
}

// ============================================================================
// FSM STATES
// ============================================================================

class IdleState extends State<WeaponState, WeaponProxy> {
  override get Name(): WeaponState {
    return 'idle';
  }

  get Animation(): WeaponAnimation | undefined {
    return this.parent.proxy.animations['idle'];
  }

  override Enter(prevState: IState<WeaponState, WeaponProxy> | null): void {
    if (!this.Animation?.action) return;

    const action = this.Animation.action;

    // Cross-fade from previous state
    const prevAnimation = (prevState as IdleState | ShootState | ReloadState)?.Animation;
    if (prevAnimation?.action) {
      action.time = 0.0;
      action.enabled = true;
      action.setEffectiveTimeScale(1.0);
      action.crossFadeFrom(prevAnimation.action, 0.1, true);
    }

    action.play();
  }

  override Update(_deltaTime: number): void {
    // Transition to shoot if shooting and have ammo
    if (this.parent.proxy.shoot && this.parent.proxy.magAmmo > 0) {
      this.parent.SetState('shoot');
    }
  }
}

class ShootState extends State<WeaponState, WeaponProxy> {
  override get Name(): WeaponState {
    return 'shoot';
  }

  get Animation(): WeaponAnimation | undefined {
    return this.parent.proxy.animations['shoot'];
  }

  override Enter(prevState: IState<WeaponState, WeaponProxy> | null): void {
    if (!this.Animation?.action) return;

    const action = this.Animation.action;

    // Cross-fade from previous state
    const prevAnimation = (prevState as IdleState | ShootState | ReloadState)?.Animation;
    if (prevAnimation?.action) {
      action.time = 0.0;
      action.enabled = true;
      action.setEffectiveTimeScale(1.0);
      action.crossFadeFrom(prevAnimation.action, 0.1, true);
    }

    // Speed up shoot animation for responsive feel
    action.timeScale = 3.0;
    action.play();
  }

  override Update(_deltaTime: number): void {
    // Return to idle if stopped shooting or out of ammo
    if (!this.parent.proxy.shoot || this.parent.proxy.magAmmo === 0) {
      this.parent.SetState('idle');
    }
  }
}

class ReloadState extends State<WeaponState, WeaponProxy> {
  private finishedHandler: ((e: { action: THREE.AnimationAction }) => void) | null = null;

  override get Name(): WeaponState {
    return 'reload';
  }

  get Animation(): WeaponAnimation | undefined {
    return this.parent.proxy.animations['reload'];
  }

  override Enter(prevState: IState<WeaponState, WeaponProxy> | null): void {
    // No reload animation - complete instantly
    if (!this.Animation?.action) {
      this.parent.proxy.ReloadDone();
      this.parent.SetState('idle');
      return;
    }

    const action = this.Animation.action;

    // Set to play once
    action.loop = THREE.LoopOnce;
    action.clampWhenFinished = true;

    // Cross-fade from previous state
    const prevAnimation = (prevState as IdleState | ShootState | ReloadState)?.Animation;
    if (prevAnimation?.action) {
      action.time = 0.0;
      action.enabled = true;
      action.setEffectiveTimeScale(1.0);
      action.crossFadeFrom(prevAnimation.action, 0.1, true);
    }

    action.play();

    // Setup finish handler
    if (this.parent.proxy.mixer) {
      this.finishedHandler = (e: { action: THREE.AnimationAction }) => {
        if (e.action !== this.Animation?.action) return;

        this.parent.proxy.ReloadDone();
        this.parent.SetState('idle');
      };
      this.parent.proxy.mixer.addEventListener('finished', this.finishedHandler as EventListener);
    }
  }

  override Exit(): void {
    // Clean up finish handler
    if (this.finishedHandler && this.parent.proxy.mixer) {
      this.parent.proxy.mixer.removeEventListener('finished', this.finishedHandler as EventListener);
      this.finishedHandler = null;
    }
  }
}

// ============================================================================
// WEAPON FSM
// ============================================================================

export default class WeaponFSM extends FiniteStateMachine<WeaponState, WeaponProxy> {
  constructor(proxy: WeaponProxy) {
    super(proxy);
    this.init();
  }

  private init(): void {
    this.AddState('idle', new IdleState(this));
    this.AddState('shoot', new ShootState(this));
    this.AddState('reload', new ReloadState(this));
  }
}

// Export types
export type { WeaponAnimation, WeaponProxy };
