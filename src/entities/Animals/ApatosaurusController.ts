/**
 * Apatosaurus Controller
 *
 * Controller for Apatosaurus (long-neck) dinosaur entities.
 * Apatosaurus is a peaceful herbivore with lots of health that flees from the player.
 *
 * Extends AnimalController - most logic is in the base class.
 */

import * as THREE from 'three';
import { AnimalController } from './AnimalController';
import { FiniteStateMachine, State, type IState } from '../../core/FiniteStateMachine';
import {
  APATOSAURUS_ANIMATION_CONFIG,
  APATOSAURUS_ENTITY_CONFIG,
  APATOSAURUS_BEHAVIOR_CONFIG,
} from '../../config/animals.config';
import type { AnimalConfig, BehaviorConfig } from '../../types/entity.types';
import type { EntityAnimationConfig } from '../../types/animation.types';

// ============================================================================
// STATE TYPES
// ============================================================================

type ApatosaurusState = 'idle' | 'wander' | 'flee' | 'dead';

// ============================================================================
// FSM STATES
// ============================================================================

class IdleState extends State<ApatosaurusState, ApatosaurusController> {
  override get Name(): ApatosaurusState {
    return 'idle';
  }

  private waitTime: number = 0;

  override Enter(_prevState: IState<ApatosaurusState, ApatosaurusController> | null): void {
    this.waitTime = Math.random() * 5 + 3; // Wait 3-8 seconds (relaxed)
    this.parent.proxy.playAnimation('idle');
  }

  override Update(deltaTime: number): void {
    this.waitTime -= deltaTime;

    // Check if player is near - flee!
    if (this.parent.proxy.isPlayerNear()) {
      this.parent.SetState('flee');
      return;
    }

    // Done waiting, wander somewhere
    if (this.waitTime <= 0) {
      this.parent.SetState('wander');
    }
  }
}

class WanderState extends State<ApatosaurusState, ApatosaurusController> {
  override get Name(): ApatosaurusState {
    return 'wander';
  }

  private stuckTimer: number = 0;
  private lastPos: THREE.Vector3 = new THREE.Vector3();

  override Enter(_prevState: IState<ApatosaurusState, ApatosaurusController> | null): void {
    this.parent.proxy.navigateToRandomPoint(50);
    this.parent.proxy.playAnimation('walk');
    this.stuckTimer = 0;
    this.lastPos.copy(this.parent.proxy.model.position);
  }

  override Update(deltaTime: number): void {
    // Check if player is near - flee!
    if (this.parent.proxy.isPlayerNear()) {
      this.parent.SetState('flee');
      return;
    }

    // Check if we've reached destination
    if (!this.parent.proxy.path?.length) {
      this.parent.SetState('idle');
      return;
    }

    // Check if stuck
    this.stuckTimer += deltaTime;
    if (this.stuckTimer > 3.0) {
      const currentPos = this.parent.proxy.model.position;
      if (currentPos.distanceTo(this.lastPos) < 0.5) {
        // We're stuck, go idle
        this.parent.proxy.clearPath();
        this.parent.SetState('idle');
        return;
      }
      this.lastPos.copy(currentPos);
      this.stuckTimer = 0;
    }
  }
}

class FleeState extends State<ApatosaurusState, ApatosaurusController> {
  override get Name(): ApatosaurusState {
    return 'flee';
  }

  private updateTimer: number = 0.5;
  private fleeTime: number = 0;

  override Enter(_prevState: IState<ApatosaurusState, ApatosaurusController> | null): void {
    this.parent.proxy.navigateAwayFromPlayer();
    this.parent.proxy.playAnimation('run');
    this.updateTimer = 0.5;
    this.fleeTime = 0;
  }

  override Update(deltaTime: number): void {
    this.fleeTime += deltaTime;
    this.updateTimer -= deltaTime;

    // Recalculate flee path periodically
    if (this.updateTimer <= 0 && this.parent.proxy.isPlayerNear()) {
      this.parent.proxy.navigateAwayFromPlayer();
      this.updateTimer = 0.5;
    }

    // Stop fleeing if safe and path is done, or after max flee time
    if (
      this.fleeTime > 5.0 ||
      (!this.parent.proxy.isPlayerNear() && !this.parent.proxy.path?.length)
    ) {
      this.parent.SetState('idle');
    }
  }
}

class DeadState extends State<ApatosaurusState, ApatosaurusController> {
  override get Name(): ApatosaurusState {
    return 'dead';
  }

  private deathTime: number = 0;

  override Enter(_prevState: IState<ApatosaurusState, ApatosaurusController> | null): void {
    this.parent.proxy.clearPath();
    this.parent.proxy.playAnimation('die', false); // Play once, don't loop
    this.parent.proxy.onDeath();
    this.parent.proxy.createBloodPool();
    this.deathTime = 0;
  }

  override Update(deltaTime: number): void {
    this.deathTime += deltaTime;
  }
}

// ============================================================================
// FSM
// ============================================================================

class ApatosaurusFSM extends FiniteStateMachine<ApatosaurusState, ApatosaurusController> {
  constructor(proxy: ApatosaurusController) {
    super(proxy);
    this.AddState('idle', new IdleState(this));
    this.AddState('wander', new WanderState(this));
    this.AddState('flee', new FleeState(this));
    this.AddState('dead', new DeadState(this));
  }
}

// ============================================================================
// CONTROLLER
// ============================================================================

export default class ApatosaurusController extends AnimalController<ApatosaurusState> {
  // Expose model for FSM states
  declare model: THREE.Object3D;

  // ============================================================================
  // CONFIG IMPLEMENTATIONS
  // ============================================================================

  protected override getAnimalConfig(): AnimalConfig {
    return APATOSAURUS_ENTITY_CONFIG;
  }

  protected override getAnimationConfig(): EntityAnimationConfig {
    return APATOSAURUS_ANIMATION_CONFIG;
  }

  protected override getBehaviorConfig(): BehaviorConfig {
    return APATOSAURUS_BEHAVIOR_CONFIG;
  }

  protected override createStateMachine(): FiniteStateMachine<ApatosaurusState, this> {
    return new ApatosaurusFSM(this) as FiniteStateMachine<ApatosaurusState, this>;
  }

  protected override getInitialState(): ApatosaurusState {
    return 'idle';
  }

  protected override getDeadState(): ApatosaurusState {
    return 'dead';
  }

  // ============================================================================
  // BEHAVIOR IMPLEMENTATIONS
  // ============================================================================

  protected override handleHitWhileAlive(): void {
    // Flee when hit
    if (this.stateMachine.currentState?.Name !== 'flee') {
      this.stateMachine.SetState('flee');
    }
  }

  // ============================================================================
  // APATOSAURUS-SPECIFIC METHODS
  // ============================================================================

  /**
   * Check if player is within flee distance.
   */
  isPlayerNear(): boolean {
    if (!this.player) return false;
    const dist = this.model.position.distanceTo(this.player.Position);
    return dist < APATOSAURUS_BEHAVIOR_CONFIG.fleeDistance!;
  }

  /**
   * Navigate away from player.
   */
  navigateAwayFromPlayer(): void {
    if (!this.player || !this.navmesh) return;

    // Calculate direction away from player
    const fleeDir = new THREE.Vector3();
    fleeDir.subVectors(this.model.position, this.player.Position);
    fleeDir.y = 0;

    if (fleeDir.lengthSq() < 0.001) {
      fleeDir.set(Math.random() - 0.5, 0, Math.random() - 0.5);
    }
    fleeDir.normalize();

    // Find a point in the flee direction
    const fleeTarget = this.model.position.clone();
    fleeTarget.add(fleeDir.multiplyScalar(30)); // Flee farther than rabbit

    // Get nearest valid navmesh point
    const node = this.navmesh.GetRandomNode(fleeTarget, 15);
    if (node) {
      this.path = this.navmesh.FindPath(this.model.position, node) || [];
    }
  }
}

// Export the FSM for external use if needed
export { ApatosaurusFSM, type ApatosaurusState };
