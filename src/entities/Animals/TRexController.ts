/**
 * T-Rex Controller
 *
 * Controller for T-Rex dinosaur entities.
 * T-Rex is a slow but powerful predator that deals massive damage.
 *
 * Extends AnimalController - most logic is in the base class.
 */

import * as THREE from 'three';
import { AnimalController } from './AnimalController';
import { FiniteStateMachine, State, type IState } from '../../core/FiniteStateMachine';
import {
  TREX_ANIMATION_CONFIG,
  TREX_ENTITY_CONFIG,
  TREX_BEHAVIOR_CONFIG,
} from '../../config/animals.config';
import type { AnimalConfig, BehaviorConfig } from '../../types/entity.types';
import type { EntityAnimationConfig } from '../../types/animation.types';

// ============================================================================
// STATE TYPES
// ============================================================================

type TRexState = 'idle' | 'patrol' | 'chase' | 'attack' | 'dead';

// ============================================================================
// FSM STATES
// ============================================================================

class IdleState extends State<TRexState, TRexController> {
  override get Name(): TRexState {
    return 'idle';
  }

  private waitTime: number = 0;

  override Enter(_prevState: IState<TRexState, TRexController> | null): void {
    this.waitTime = Math.random() * 3 + 2; // Wait 2-5 seconds (slower)
    this.parent.proxy.playAnimation('idle');
  }

  override Update(deltaTime: number): void {
    this.waitTime -= deltaTime;

    // Check if player is visible - chase!
    if (this.parent.proxy.canSeePlayer()) {
      this.parent.SetState('chase');
      return;
    }

    // Done waiting, patrol somewhere
    if (this.waitTime <= 0) {
      this.parent.SetState('patrol');
    }
  }
}

class PatrolState extends State<TRexState, TRexController> {
  override get Name(): TRexState {
    return 'patrol';
  }

  private stuckTimer: number = 0;
  private lastPos: THREE.Vector3 = new THREE.Vector3();

  override Enter(_prevState: IState<TRexState, TRexController> | null): void {
    this.parent.proxy.navigateToRandomPoint(40);
    this.parent.proxy.playAnimation('walk');
    this.stuckTimer = 0;
    this.lastPos.copy(this.parent.proxy.model.position);
  }

  override Update(deltaTime: number): void {
    // Check if player is visible - chase!
    if (this.parent.proxy.canSeePlayer()) {
      this.parent.SetState('chase');
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
        this.parent.proxy.clearPath();
        this.parent.SetState('idle');
        return;
      }
      this.lastPos.copy(currentPos);
      this.stuckTimer = 0;
    }
  }
}

class ChaseState extends State<TRexState, TRexController> {
  override get Name(): TRexState {
    return 'chase';
  }

  private updateTimer: number = 0.5;
  private chaseTime: number = 0;
  private lostPlayerTime: number = 0;

  override Enter(_prevState: IState<TRexState, TRexController> | null): void {
    this.parent.proxy.navigateToPlayer();
    this.parent.proxy.playAnimation('run');
    this.updateTimer = 0.5;
    this.chaseTime = 0;
    this.lostPlayerTime = 0;
  }

  override Update(deltaTime: number): void {
    this.chaseTime += deltaTime;
    this.updateTimer -= deltaTime;

    // Check if close enough to attack
    if (this.parent.proxy.isCloseToPlayer()) {
      this.parent.SetState('attack');
      return;
    }

    // Recalculate path periodically
    if (this.updateTimer <= 0) {
      if (this.parent.proxy.canSeePlayer()) {
        this.parent.proxy.navigateToPlayer();
        this.lostPlayerTime = 0;
      } else {
        this.lostPlayerTime += 0.5;
      }
      this.updateTimer = 0.5;
    }

    // Give up if lost player for too long
    if (this.lostPlayerTime > 8.0 || !this.parent.proxy.path?.length) {
      this.parent.SetState('idle');
    }
  }
}

class AttackState extends State<TRexState, TRexController> {
  override get Name(): TRexState {
    return 'attack';
  }

  private attackTimer: number = 0;
  private hasHit: boolean = false;
  private readonly attackDuration: number = 1.2; // Slower attack

  override Enter(_prevState: IState<TRexState, TRexController> | null): void {
    this.attackTimer = 0;
    this.hasHit = false;
    this.parent.proxy.playAnimation('attack');
  }

  override Update(deltaTime: number): void {
    this.attackTimer += deltaTime;

    // Face the player
    this.parent.proxy.facePlayer(deltaTime, 3.0);

    // Hit at 50% through the attack
    if (!this.hasHit && this.attackTimer > this.attackDuration * 0.5) {
      if (this.parent.proxy.isCloseToPlayer()) {
        this.parent.proxy.hitPlayer();
      }
      this.hasHit = true;
    }

    // Attack finished
    if (this.attackTimer >= this.attackDuration) {
      // Continue attacking if still close, otherwise chase
      if (this.parent.proxy.isCloseToPlayer()) {
        this.parent.SetState('attack'); // Reset attack
      } else {
        this.parent.SetState('chase');
      }
    }
  }
}

class DeadState extends State<TRexState, TRexController> {
  override get Name(): TRexState {
    return 'dead';
  }

  private deathTime: number = 0;

  override Enter(_prevState: IState<TRexState, TRexController> | null): void {
    this.parent.proxy.clearPath();
    this.parent.proxy.playAnimation('die', false);
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

class TRexFSM extends FiniteStateMachine<TRexState, TRexController> {
  constructor(proxy: TRexController) {
    super(proxy);
    this.AddState('idle', new IdleState(this));
    this.AddState('patrol', new PatrolState(this));
    this.AddState('chase', new ChaseState(this));
    this.AddState('attack', new AttackState(this));
    this.AddState('dead', new DeadState(this));
  }
}

// ============================================================================
// CONTROLLER
// ============================================================================

export default class TRexController extends AnimalController<TRexState> {
  // Expose model for FSM states
  declare model: THREE.Object3D;

  // ============================================================================
  // CONFIG IMPLEMENTATIONS
  // ============================================================================

  protected override getAnimalConfig(): AnimalConfig {
    return TREX_ENTITY_CONFIG;
  }

  protected override getAnimationConfig(): EntityAnimationConfig {
    return TREX_ANIMATION_CONFIG;
  }

  protected override getBehaviorConfig(): BehaviorConfig {
    return TREX_BEHAVIOR_CONFIG;
  }

  protected override createStateMachine(): FiniteStateMachine<TRexState, this> {
    return new TRexFSM(this) as FiniteStateMachine<TRexState, this>;
  }

  protected override getInitialState(): TRexState {
    return 'idle';
  }

  protected override getDeadState(): TRexState {
    return 'dead';
  }

  // ============================================================================
  // BEHAVIOR IMPLEMENTATIONS
  // ============================================================================

  protected override handleHitWhileAlive(): void {
    // Become aggressive when hit
    const currentState = this.stateMachine.currentState?.Name;
    if (currentState !== 'chase' && currentState !== 'attack') {
      this.stateMachine.SetState('chase');
    }
  }

  /**
   * Get move speed - faster when chasing.
   */
  protected override getMoveSpeed(): number {
    const currentState = this.stateMachine.currentState?.Name;
    if (currentState === 'chase') {
      return TREX_BEHAVIOR_CONFIG.chaseSpeed!;
    }
    return TREX_ENTITY_CONFIG.speed;
  }

  // ============================================================================
  // DEATH HANDLING - Override to drop weapons (chance)
  // ============================================================================

  protected override notifyManagers(): void {
    super.notifyManagers();

    // 60% chance to drop a weapon when T-Rex dies (more rewarding)
    const spawnManager = this.FindEntity('SpawnManager');
    if (spawnManager && Math.random() < 0.6) {
      spawnManager.Broadcast({
        topic: 'fox_weapon_drop',
        position: this.model.position.clone(),
      });
    }
  }

  // ============================================================================
  // TREX-SPECIFIC METHODS
  // ============================================================================

  /**
   * Check if player is within view distance.
   */
  canSeePlayer(): boolean {
    if (!this.player) return false;

    const playerPos = this.player.Position;
    const trexPos = this.model.position;

    const dx = playerPos.x - trexPos.x;
    const dz = playerPos.z - trexPos.z;
    const distSq = dx * dx + dz * dz;

    return distSq <= TREX_BEHAVIOR_CONFIG.viewDistance! ** 2;
  }

  /**
   * Check if close enough to attack.
   */
  isCloseToPlayer(): boolean {
    if (!this.player) return false;
    const dist = this.model.position.distanceTo(this.player.Position);
    return dist < TREX_BEHAVIOR_CONFIG.attackDistance!;
  }

  /**
   * Navigate towards player.
   */
  navigateToPlayer(): void {
    if (!this.player || !this.navmesh) return;

    this.tempVec.copy(this.player.Position);
    this.tempVec.y = 0;
    this.path = this.navmesh.FindPath(this.model.position, this.tempVec) || [];
  }

  /**
   * Face towards player.
   */
  facePlayer(deltaTime: number, rate: number = 2.0): void {
    if (!this.player) return;

    this.tempVec.copy(this.player.Position).sub(this.model.position);
    this.tempVec.y = 0;

    if (this.tempVec.lengthSq() < 0.001) return;

    this.tempVec.normalize();
    this.tempRot.setFromUnitVectors(this.forwardVec, this.tempVec);
    this.model.quaternion.slerp(this.tempRot, rate * deltaTime);
  }

  /**
   * Deal massive damage to player.
   */
  hitPlayer(): void {
    if (this.player) {
      this.player.Broadcast({
        topic: 'hit',
        amount: TREX_BEHAVIOR_CONFIG.attackDamage!,
      });
    }
  }
}

// Export the FSM for external use if needed
export { TRexFSM, type TRexState };
