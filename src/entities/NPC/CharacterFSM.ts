/**
 * Character Finite State Machine
 *
 * Handles mutant character states: idle, patrol, chase, attack, dead.
 */

import * as THREE from 'three';
import { FiniteStateMachine, State, type IState } from '../../core/FiniteStateMachine';
import type CharacterController from './CharacterController';
import type { CharacterAnimation } from './CharacterController';

// ============================================================================
// TYPES
// ============================================================================

export type MutantState = 'idle' | 'patrol' | 'chase' | 'attack' | 'dead';

// ============================================================================
// STATE BASE
// ============================================================================

abstract class MutantStateBase extends State<MutantState, CharacterController> {
  abstract get Animation(): CharacterAnimation | undefined;
}

// ============================================================================
// IDLE STATE
// ============================================================================

class IdleState extends MutantStateBase {
  private readonly maxWaitTime: number = 5.0;
  private readonly minWaitTime: number = 1.0;
  private waitTime: number = 0.0;

  override get Name(): MutantState {
    return 'idle';
  }

  get Animation(): CharacterAnimation | undefined {
    return this.parent.proxy.animations['idle'];
  }

  override Enter(prevState: IState<MutantState, CharacterController> | null): void {
    this.parent.proxy.canMove = false;

    if (!this.Animation?.action) return;
    const action = this.Animation.action;

    const prevAnimation = (prevState as MutantStateBase | null)?.Animation;
    if (prevAnimation?.action) {
      action.time = 0.0;
      action.enabled = true;
      action.crossFadeFrom(prevAnimation.action, 0.5, true);
    }

    action.play();

    this.waitTime = Math.random() * (this.maxWaitTime - this.minWaitTime) + this.minWaitTime;
  }

  override Update(deltaTime: number): void {
    if (this.waitTime <= 0.0) {
      this.parent.SetState('patrol');
      return;
    }

    this.waitTime -= deltaTime;

    if (this.parent.proxy.CanSeeThePlayer()) {
      this.parent.SetState('chase');
    }
  }
}

// ============================================================================
// PATROL STATE
// ============================================================================

class PatrolState extends MutantStateBase {
  override get Name(): MutantState {
    return 'patrol';
  }

  get Animation(): CharacterAnimation | undefined {
    return this.parent.proxy.animations['walk'];
  }

  override Enter(prevState: IState<MutantState, CharacterController> | null): void {
    this.parent.proxy.canMove = true;

    if (!this.Animation?.action) return;
    const action = this.Animation.action;

    const prevAnimation = (prevState as MutantStateBase | null)?.Animation;
    if (prevAnimation?.action) {
      action.time = 0.0;
      action.enabled = true;
      action.crossFadeFrom(prevAnimation.action, 0.5, true);
    }

    action.play();

    this.parent.proxy.NavigateToRandomPoint();
  }

  override Update(_deltaTime: number): void {
    if (this.parent.proxy.CanSeeThePlayer()) {
      this.parent.SetState('chase');
    } else if (this.parent.proxy.path && this.parent.proxy.path.length === 0) {
      this.parent.SetState('idle');
    }
  }
}

// ============================================================================
// CHASE STATE
// ============================================================================

class ChaseState extends MutantStateBase {
  private readonly updateFrequency: number = 0.5;
  private updateTimer: number = 0.0;
  private switchDelay: number = 0.2;

  override get Name(): MutantState {
    return 'chase';
  }

  get Animation(): CharacterAnimation | undefined {
    return this.parent.proxy.animations['run'];
  }

  private runToPlayer(prevState: IState<MutantState, CharacterController> | null): void {
    this.parent.proxy.canMove = true;

    if (!this.Animation?.action) return;
    const action = this.Animation.action;
    this.updateTimer = 0.0;

    const prevAnimation = (prevState as MutantStateBase | null)?.Animation;
    if (prevAnimation?.action) {
      action.time = 0.0;
      action.enabled = true;
      action.setEffectiveTimeScale(1.0);
      action.setEffectiveWeight(1.0);
      action.crossFadeFrom(prevAnimation.action, 0.2, true);
    }

    action.timeScale = 1.5;
    action.play();
  }

  override Enter(prevState: IState<MutantState, CharacterController> | null): void {
    this.runToPlayer(prevState);
  }

  override Update(deltaTime: number): void {
    if (this.updateTimer <= 0.0) {
      this.parent.proxy.NavigateToPlayer();
      this.updateTimer = this.updateFrequency;
    }

    if (this.parent.proxy.IsCloseToPlayer) {
      if (this.switchDelay <= 0.0) {
        this.parent.SetState('attack');
      }

      this.parent.proxy.ClearPath();
      this.switchDelay -= deltaTime;
    } else {
      this.switchDelay = 0.1;
    }

    this.updateTimer -= deltaTime;
  }
}

// ============================================================================
// ATTACK STATE
// ============================================================================

class AttackState extends MutantStateBase {
  private attackTime: number = 0.0;
  private attackEvent: number = 0.0;
  private canHit: boolean = true;

  override get Name(): MutantState {
    return 'attack';
  }

  get Animation(): CharacterAnimation | undefined {
    return this.parent.proxy.animations['attack'];
  }

  override Enter(prevState: IState<MutantState, CharacterController> | null): void {
    this.parent.proxy.canMove = false;

    if (!this.Animation?.action) return;
    const action = this.Animation.action;

    this.attackTime = this.Animation.clip.duration;
    this.attackEvent = this.attackTime * 0.85;

    const prevAnimation = (prevState as MutantStateBase | null)?.Animation;
    if (prevAnimation?.action) {
      action.time = 0.0;
      action.enabled = true;
      action.crossFadeFrom(prevAnimation.action, 0.1, true);
    }

    action.play();
  }

  override Update(deltaTime: number): void {
    this.parent.proxy.FacePlayer(deltaTime);

    if (!this.parent.proxy.IsCloseToPlayer && this.attackTime <= 0.0) {
      this.parent.SetState('chase');
      return;
    }

    if (this.canHit && this.attackTime <= this.attackEvent && this.parent.proxy.IsPlayerInHitbox) {
      this.parent.proxy.HitPlayer();
      this.canHit = false;
    }

    if (this.attackTime <= 0.0) {
      this.attackTime = this.Animation?.clip.duration ?? 0;
      this.canHit = true;
    }

    this.attackTime -= deltaTime;
  }
}

// ============================================================================
// DEAD STATE
// ============================================================================

class DeadState extends MutantStateBase {
  override get Name(): MutantState {
    return 'dead';
  }

  get Animation(): CharacterAnimation | undefined {
    return this.parent.proxy.animations['die'];
  }

  override Enter(prevState: IState<MutantState, CharacterController> | null): void {
    if (!this.Animation?.action) return;
    const action = this.Animation.action;

    action.setLoop(THREE.LoopOnce, 1);
    action.clampWhenFinished = true;

    const prevAnimation = (prevState as MutantStateBase | null)?.Animation;
    if (prevAnimation?.action) {
      action.time = 0.0;
      action.enabled = true;
      action.crossFadeFrom(prevAnimation.action, 0.1, true);
    }

    action.play();
  }

  override Update(_deltaTime: number): void {
    // Dead - no updates
  }
}

// ============================================================================
// CHARACTER FSM
// ============================================================================

export default class CharacterFSM extends FiniteStateMachine<MutantState, CharacterController> {
  constructor(proxy: CharacterController) {
    super(proxy);
    this.init();
  }

  private init(): void {
    this.AddState('idle', new IdleState(this));
    this.AddState('patrol', new PatrolState(this));
    this.AddState('chase', new ChaseState(this));
    this.AddState('attack', new AttackState(this));
    this.AddState('dead', new DeadState(this));
  }
}
