/**
 * Finite State Machine
 *
 * Generic FSM implementation with compile-time state validation.
 * Used for entity AI, weapons, and other state-based systems.
 *
 * @template TStateEnum - Union type of valid state names
 * @template TProxy - The controller/owner that states can access
 */

import type { AnimationActionName } from '../types/animation.types';

/**
 * State interface - defines the contract for FSM states.
 */
export interface IState<TStateEnum extends string, TProxy> {
  /** State name - must match one of the enum values */
  readonly Name: TStateEnum;

  /** Reference to the parent FSM */
  readonly parent: FiniteStateMachine<TStateEnum, TProxy>;

  /**
   * Called when entering this state.
   * @param prevState - The state we're transitioning from (null if initial)
   */
  Enter(prevState: IState<TStateEnum, TProxy> | null): void;

  /**
   * Called when exiting this state.
   */
  Exit(): void;

  /**
   * Called each frame while in this state.
   * @param deltaTime - Time since last frame in seconds
   */
  Update(deltaTime: number): void;
}

/**
 * Finite State Machine - manages state transitions.
 */
export class FiniteStateMachine<TStateEnum extends string, TProxy> {
  /** Map of state names to state instances */
  protected states: Map<TStateEnum, IState<TStateEnum, TProxy>> = new Map();

  /** Currently active state */
  protected _currentState: IState<TStateEnum, TProxy> | null = null;

  /** Reference to the controller/owner */
  public readonly proxy: TProxy;

  constructor(proxy: TProxy) {
    this.proxy = proxy;
  }

  /**
   * Get the current state.
   */
  get currentState(): IState<TStateEnum, TProxy> | null {
    return this._currentState;
  }

  /**
   * Add a state to the FSM.
   */
  AddState(name: TStateEnum, state: IState<TStateEnum, TProxy>): void {
    this.states.set(name, state);
  }

  /**
   * Transition to a new state.
   * If already in the requested state, does nothing.
   */
  SetState(name: TStateEnum): void {
    const nextState = this.states.get(name);
    if (!nextState) {
      console.error(
        `FSM: Unknown state "${name}". Available: ${Array.from(this.states.keys()).join(', ')}`
      );
      return;
    }

    const prevState = this._currentState;

    // Don't transition to the same state
    if (prevState?.Name === name) {
      return;
    }

    // Exit current state
    prevState?.Exit();

    // Enter new state
    this._currentState = nextState;
    nextState.Enter(prevState);
  }

  /**
   * Update the current state.
   */
  Update(deltaTime: number): void {
    this._currentState?.Update(deltaTime);
  }
}

/**
 * Base State class - provides common functionality for states.
 */
export class State<TStateEnum extends string, TProxy>
  implements IState<TStateEnum, TProxy>
{
  /**
   * State name - subclasses must override this getter.
   */
  get Name(): TStateEnum {
    throw new Error('State subclass must implement Name getter');
  }

  constructor(public readonly parent: FiniteStateMachine<TStateEnum, TProxy>) {}

  Enter(_prevState: IState<TStateEnum, TProxy> | null): void {
    // Override in subclass
  }

  Exit(): void {
    // Override in subclass
  }

  Update(_deltaTime: number): void {
    // Override in subclass
  }
}

/**
 * Animated State - state that plays an animation on enter.
 * Requires the proxy to have a playAnimation method.
 */
export interface AnimatedProxy {
  playAnimation(name: AnimationActionName, loop?: boolean): void;
}

export abstract class AnimatedState<
  TStateEnum extends string,
  TProxy extends AnimatedProxy
> extends State<TStateEnum, TProxy> {
  /**
   * The animation to play when entering this state.
   * Override in subclass.
   */
  abstract readonly animationName: AnimationActionName;

  /**
   * Whether the animation should loop. Default: true
   */
  readonly animationLoop: boolean = true;

  override Enter(prevState: IState<TStateEnum, TProxy> | null): void {
    // Play animation on enter
    this.parent.proxy.playAnimation(this.animationName, this.animationLoop);
    this.onEnter(prevState);
  }

  /**
   * Called after animation is started.
   * Override for additional enter logic.
   */
  protected onEnter(_prevState: IState<TStateEnum, TProxy> | null): void {
    // Override in subclass
  }

  override Exit(): void {
    this.onExit();
  }

  /**
   * Called when exiting the state.
   * Override for cleanup logic.
   */
  protected onExit(): void {
    // Override in subclass
  }
}

// Re-export for backwards compatibility during migration
export { FiniteStateMachine as default };
