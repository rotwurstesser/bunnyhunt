/**
 * Rabbit Controller
 *
 * Controller for rabbit entities.
 * Rabbits are prey that flee from the player.
 *
 * Extends AnimalController - most logic is in the base class.
 */

import * as THREE from 'three';
import { AnimalController } from './AnimalController';
import { FiniteStateMachine, State, type IState } from '../../core/FiniteStateMachine';
import {
  RABBIT_ANIMATION_CONFIG,
  RABBIT_ENTITY_CONFIG,
  RABBIT_BEHAVIOR_CONFIG,
} from '../../config/animals.config';
import type { AnimalConfig, BehaviorConfig } from '../../types/entity.types';
import type { EntityAnimationConfig } from '../../types/animation.types';

// ============================================================================
// STATE TYPES
// ============================================================================

type RabbitState = 'idle' | 'wander' | 'flee' | 'dead';

// ============================================================================
// FSM STATES
// ============================================================================

class IdleState extends State<RabbitState, RabbitController> {
  override get Name(): RabbitState {
    return 'idle';
  }

  private waitTime: number = 0;

  override Enter(_prevState: IState<RabbitState, RabbitController> | null): void {
    this.waitTime = Math.random() * 3 + 1; // Wait 1-4 seconds
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

class WanderState extends State<RabbitState, RabbitController> {
  override get Name(): RabbitState {
    return 'wander';
  }

  private stuckTimer: number = 0;
  private lastPos: THREE.Vector3 = new THREE.Vector3();

  override Enter(_prevState: IState<RabbitState, RabbitController> | null): void {
    this.parent.proxy.navigateToRandomPoint();
    this.parent.proxy.playAnimation('run');
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
    if (this.stuckTimer > 2.0) {
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

class FleeState extends State<RabbitState, RabbitController> {
  override get Name(): RabbitState {
    return 'flee';
  }

  private updateTimer: number = 0.5;
  private fleeTime: number = 0;

  override Enter(_prevState: IState<RabbitState, RabbitController> | null): void {
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
      this.fleeTime > 3.0 ||
      (!this.parent.proxy.isPlayerNear() && !this.parent.proxy.path?.length)
    ) {
      this.parent.SetState('idle');
    }
  }
}

class DeadState extends State<RabbitState, RabbitController> {
  override get Name(): RabbitState {
    return 'dead';
  }

  private deathTime: number = 0;

  override Enter(_prevState: IState<RabbitState, RabbitController> | null): void {
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

class RabbitFSM extends FiniteStateMachine<RabbitState, RabbitController> {
  constructor(proxy: RabbitController) {
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

export default class RabbitController extends AnimalController<RabbitState> {
  // Expose model for FSM states
  declare model: THREE.Object3D;

  // ============================================================================
  // CONFIG IMPLEMENTATIONS
  // ============================================================================

  protected override getAnimalConfig(): AnimalConfig {
    return RABBIT_ENTITY_CONFIG;
  }

  protected override getAnimationConfig(): EntityAnimationConfig {
    return RABBIT_ANIMATION_CONFIG;
  }

  protected override getBehaviorConfig(): BehaviorConfig {
    return RABBIT_BEHAVIOR_CONFIG;
  }

  protected override createStateMachine(): FiniteStateMachine<RabbitState, this> {
    return new RabbitFSM(this) as FiniteStateMachine<RabbitState, this>;
  }

  protected override getInitialState(): RabbitState {
    return 'idle';
  }

  protected override getDeadState(): RabbitState {
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
  // RABBIT-SPECIFIC METHODS
  // ============================================================================

  /**
   * Check if player is within flee distance.
   */
  isPlayerNear(): boolean {
    if (!this.player) return false;
    const dist = this.model.position.distanceTo(this.player.Position);
    return dist < RABBIT_BEHAVIOR_CONFIG.fleeDistance!;
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
    fleeTarget.add(fleeDir.multiplyScalar(20));

    // Get nearest valid navmesh point
    const node = this.navmesh.GetRandomNode(fleeTarget, 10);
    if (node) {
      this.path = this.navmesh.FindPath(this.model.position, node) || [];
    }
  }
}

// Export the FSM for external use if needed
export { RabbitFSM, type RabbitState };
