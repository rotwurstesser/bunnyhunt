/**
 * Fox Controller
 *
 * Controller for fox entities.
 * Foxes are predators that chase and attack the player.
 *
 * Extends AnimalController - most logic is in the base class.
 */

import * as THREE from 'three';
import { AnimalController } from './AnimalController';
import { FiniteStateMachine, State, type IState } from '../../core/FiniteStateMachine';
import {
  FOX_ANIMATION_CONFIG,
  FOX_ENTITY_CONFIG,
  FOX_BEHAVIOR_CONFIG,
} from '../../config/animals.config';
import type { AnimalConfig, BehaviorConfig } from '../../types/entity.types';
import type { EntityAnimationConfig } from '../../types/animation.types';

// ============================================================================
// STATE TYPES
// ============================================================================

type FoxState = 'idle' | 'patrol' | 'chase' | 'attack' | 'dead';

// ============================================================================
// FSM STATES
// ============================================================================

class IdleState extends State<FoxState, FoxController> {
  override get Name(): FoxState {
    return 'idle';
  }

  private waitTime: number = 0;

  override Enter(_prevState: IState<FoxState, FoxController> | null): void {
    this.waitTime = Math.random() * 2 + 1; // Wait 1-3 seconds
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

class PatrolState extends State<FoxState, FoxController> {
  override get Name(): FoxState {
    return 'patrol';
  }

  private stuckTimer: number = 0;
  private lastPos: THREE.Vector3 = new THREE.Vector3();

  override Enter(_prevState: IState<FoxState, FoxController> | null): void {
    this.parent.proxy.navigateToRandomPoint(30);
    this.parent.proxy.playAnimation('run');
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
    if (this.stuckTimer > 2.0) {
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

class ChaseState extends State<FoxState, FoxController> {
  override get Name(): FoxState {
    return 'chase';
  }

  private updateTimer: number = 0.5;
  private chaseTime: number = 0;
  private lostPlayerTime: number = 0;

  override Enter(_prevState: IState<FoxState, FoxController> | null): void {
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
    if (this.lostPlayerTime > 5.0 || !this.parent.proxy.path?.length) {
      this.parent.SetState('idle');
    }
  }
}

class AttackState extends State<FoxState, FoxController> {
  override get Name(): FoxState {
    return 'attack';
  }

  private attackTimer: number = 0;
  private hasHit: boolean = false;
  private readonly attackDuration: number = 0.8;

  override Enter(_prevState: IState<FoxState, FoxController> | null): void {
    this.attackTimer = 0;
    this.hasHit = false;
    this.parent.proxy.playAnimation('attack');
  }

  override Update(deltaTime: number): void {
    this.attackTimer += deltaTime;

    // Face the player
    this.parent.proxy.facePlayer(deltaTime, 5.0);

    // Hit at 60% through the attack
    if (!this.hasHit && this.attackTimer > this.attackDuration * 0.6) {
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

class DeadState extends State<FoxState, FoxController> {
  override get Name(): FoxState {
    return 'dead';
  }

  private deathTime: number = 0;

  override Enter(_prevState: IState<FoxState, FoxController> | null): void {
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

class FoxFSM extends FiniteStateMachine<FoxState, FoxController> {
  constructor(proxy: FoxController) {
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

export default class FoxController extends AnimalController<FoxState> {
  // Expose model for FSM states
  declare model: THREE.Object3D;

  // ============================================================================
  // CONFIG IMPLEMENTATIONS
  // ============================================================================

  protected override getAnimalConfig(): AnimalConfig {
    return FOX_ENTITY_CONFIG;
  }

  protected override getAnimationConfig(): EntityAnimationConfig {
    return FOX_ANIMATION_CONFIG;
  }

  protected override getBehaviorConfig(): BehaviorConfig {
    return FOX_BEHAVIOR_CONFIG;
  }

  protected override createStateMachine(): FiniteStateMachine<FoxState, this> {
    return new FoxFSM(this) as FiniteStateMachine<FoxState, this>;
  }

  protected override getInitialState(): FoxState {
    return 'idle';
  }

  protected override getDeadState(): FoxState {
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
      return FOX_BEHAVIOR_CONFIG.chaseSpeed!;
    }
    return FOX_ENTITY_CONFIG.speed;
  }

  // ============================================================================
  // DEATH HANDLING - Override to drop weapons
  // ============================================================================

  protected override notifyManagers(): void {
    super.notifyManagers();

    // 40% chance to drop a weapon when fox dies
    const spawnManager = this.FindEntity('SpawnManager');
    if (spawnManager && Math.random() < 0.4) {
      spawnManager.Broadcast({
        topic: 'fox_weapon_drop',
        position: this.model.position.clone(),
      });
    }
  }

  // ============================================================================
  // FOX-SPECIFIC METHODS
  // ============================================================================

  /**
   * Check if player is within view distance.
   * Simplified: fox can always see player if within range.
   */
  canSeePlayer(): boolean {
    if (!this.player) return false;

    const playerPos = this.player.Position;
    const foxPos = this.model.position;

    const dx = playerPos.x - foxPos.x;
    const dz = playerPos.z - foxPos.z;
    const distSq = dx * dx + dz * dz;

    return distSq <= FOX_BEHAVIOR_CONFIG.viewDistance! ** 2;
  }

  /**
   * Check if close enough to attack.
   */
  isCloseToPlayer(): boolean {
    if (!this.player) return false;
    const dist = this.model.position.distanceTo(this.player.Position);
    return dist < FOX_BEHAVIOR_CONFIG.attackDistance!;
  }

  /**
   * Navigate towards player.
   */
  navigateToPlayer(): void {
    if (!this.player || !this.navmesh) return;

    this.tempVec.copy(this.player.Position);
    this.tempVec.y = 0; // Match navmesh Y level
    this.path = this.navmesh.FindPath(this.model.position, this.tempVec) || [];
  }

  /**
   * Face towards player.
   */
  facePlayer(deltaTime: number, rate: number = 3.0): void {
    if (!this.player) return;

    this.tempVec.copy(this.player.Position).sub(this.model.position);
    this.tempVec.y = 0;

    if (this.tempVec.lengthSq() < 0.001) return;

    this.tempVec.normalize();
    this.tempRot.setFromUnitVectors(this.forwardVec, this.tempVec);
    this.model.quaternion.slerp(this.tempRot, rate * deltaTime);
  }

  /**
   * Deal damage to player.
   */
  hitPlayer(): void {
    if (this.player) {
      this.player.Broadcast({
        topic: 'hit',
        amount: FOX_BEHAVIOR_CONFIG.attackDamage!,
      });
    }
  }
}

// Export the FSM for external use if needed
export { FoxFSM, type FoxState };
