/**
 * Event System Type Definitions
 *
 * Uses discriminated unions for type-safe event handling.
 * The 'topic' field acts as the discriminant.
 */

import type * as THREE from 'three';
import type { IEntity } from './entity.types';
import type { AnimalType, WeaponKey } from './animation.types';

/**
 * Hit result from raycast.
 */
export interface HitResult {
  /** Point of intersection */
  intersectionPoint: THREE.Vector3;

  /** Normal at intersection */
  intersectionNormal: THREE.Vector3;

  /** The Ammo collision object that was hit */
  collisionObject: unknown;
}

/**
 * Hit event - damage dealt to an entity.
 */
export interface HitEvent {
  topic: 'hit';

  /** Damage amount */
  amount: number;

  /** Entity that caused the damage (optional) */
  from?: IEntity;

  /** Raycast hit result (optional) */
  hitResult?: HitResult;
}

/**
 * Animal killed event - sent to GameManager for scoring.
 */
export interface AnimalKilledEvent {
  topic: 'animal_killed';

  /** The entity that was killed */
  entity: IEntity;

  /** Type of animal killed */
  type: AnimalType;
}

/**
 * Animal died event - sent to SpawnManager for respawn.
 */
export interface AnimalDiedEvent {
  topic: 'animal_died';

  /** The entity that died */
  entity: IEntity;

  /** Type of animal */
  type: AnimalType;

  /** Position where the animal died */
  position: THREE.Vector3;
}

/**
 * Weapon upgrade event - player earned a new weapon tier.
 */
export interface WeaponUpgradeEvent {
  topic: 'weapon_upgrade';

  /** New weapon tier (1-4) */
  tier: number;

  /** Name of the new weapon */
  weaponName: string;
}

/**
 * Weapon shot event - for UI/audio feedback.
 */
export interface WeaponShotEvent {
  topic: 'weapon_shot';

  /** Which weapon was fired */
  weapon: WeaponKey;
}

/**
 * Weapon pickup event - player picked up a weapon.
 */
export interface WeaponPickupEvent {
  topic: 'weapon_pickup';

  /** Which weapon was picked up */
  weaponKey: WeaponKey;
}

/**
 * Ammo pickup event - player picked up ammo.
 */
export interface AmmoPickupEvent {
  topic: 'AmmoPickup';
}

/**
 * Nuke fired event - special weapon fired.
 */
export interface NukeFiredEvent {
  topic: 'nuke_fired';

  /** Starting position of the projectile */
  startPosition: THREE.Vector3;

  /** Direction of travel */
  direction: THREE.Vector3;

  /** Camera reference for effects */
  camera: THREE.Camera;
}

/**
 * Nuke detonated event - nuke explosion.
 */
export interface NukeDetonatedEvent {
  topic: 'nuke_detonated';
}

/**
 * Fox weapon drop event - fox died and may drop a weapon.
 */
export interface FoxWeaponDropEvent {
  topic: 'fox_weapon_drop';

  /** Position to spawn the weapon pickup */
  position: THREE.Vector3;
}

/**
 * Navigation end event - entity reached end of path.
 */
export interface NavEndEvent {
  topic: 'nav.end';

  /** The component that finished navigating */
  agent: unknown;
}

/**
 * Ammo changed event - for UI updates.
 */
export interface AmmoChangedEvent {
  topic: 'ammo_changed';

  /** Current ammo in magazine */
  current: number;

  /** Maximum magazine capacity */
  max: number;
}

/**
 * Health changed event - for UI updates.
 */
export interface HealthChangedEvent {
  topic: 'health_changed';

  /** Current health */
  current: number;

  /** Maximum health */
  max: number;
}

/**
 * Union of all game events.
 * Use this type for event handlers and broadcasts.
 */
export type GameEvent =
  | HitEvent
  | AnimalKilledEvent
  | AnimalDiedEvent
  | WeaponUpgradeEvent
  | WeaponShotEvent
  | WeaponPickupEvent
  | AmmoPickupEvent
  | NukeFiredEvent
  | NukeDetonatedEvent
  | FoxWeaponDropEvent
  | NavEndEvent
  | AmmoChangedEvent
  | HealthChangedEvent;

/**
 * Extract event type by topic.
 * Usage: EventByTopic<'hit'> gives HitEvent
 */
export type EventByTopic<T extends GameEvent['topic']> = Extract<
  GameEvent,
  { topic: T }
>;

/**
 * All possible event topics.
 */
export type EventTopic = GameEvent['topic'];

/**
 * Event handler type for a specific topic.
 */
export type EventHandler<T extends EventTopic> = (event: EventByTopic<T>) => void;
