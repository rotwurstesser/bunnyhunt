/**
 * Core module exports
 */

// Base classes
export { default as Entity } from './Entity';
export { default as EntityManager } from './EntityManager';
export { default as Component } from './Component';

// FSM
export {
  FiniteStateMachine,
  State,
  AnimatedState,
  type IState,
  type AnimatedProxy,
} from './FiniteStateMachine';

// Input
export { default as Input, type KeyCode } from './Input';

// Physics
export {
  AmmoHelper,
  Ammo,
  createConvexHullShape,
  CollisionFlags,
  CollisionFilterGroups,
  type CollisionFilterGroup,
  type RaycastResult,
} from './AmmoLib';
