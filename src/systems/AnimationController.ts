/**
 * Animation Controller
 *
 * Unified animation handling system that works with different animation sources:
 * - GLTF-embedded: Animations included in the model file (Rabbit, Fox)
 * - FBX-separate: Animations loaded from separate files (Mutant)
 * - Index-based: Animations referenced by array index (Weapons - legacy)
 *
 * Uses ClipMatcher to map model-specific clip names to standard action names.
 */

import * as THREE from 'three';
import type {
  AnimationActionName,
  AnimationPlayOptions,
  EntityAnimationConfig,
  AnimationActionMap,
  AnimationClipDict,
} from '../types/animation.types';

/**
 * Default play options for animations.
 */
const DEFAULT_PLAY_OPTIONS: Required<AnimationPlayOptions> = {
  loop: true,
  crossFadeDuration: 0.2,
  timeScale: 1.0,
  clampWhenFinished: false,
};

/**
 * Animation Controller - manages animation playback for an entity.
 */
export class AnimationController {
  /** Three.js animation mixer */
  private mixer: THREE.AnimationMixer | null = null;

  /** Map of action names to animation actions */
  private actions: AnimationActionMap = new Map();

  /** Currently playing action */
  private currentAction: THREE.AnimationAction | null = null;

  /** Configuration for this entity type */
  private readonly config: EntityAnimationConfig;

  constructor(config: EntityAnimationConfig) {
    this.config = config;
  }

  /**
   * Get the animation mixer (if set up).
   */
  getMixer(): THREE.AnimationMixer | null {
    return this.mixer;
  }

  /**
   * Check if an animation is available.
   */
  hasAnimation(name: AnimationActionName): boolean {
    return this.actions.has(name) || !!this.config.fallbacks[name];
  }

  /**
   * Get all available animation names.
   */
  getAvailableAnimations(): AnimationActionName[] {
    return Array.from(this.actions.keys());
  }

  /**
   * Set up animations from a model with embedded clips (GLTF).
   *
   * @param model - The loaded model with animations
   */
  setupFromModel(model: THREE.Object3D): void {
    if (this.config.source !== 'gltf-embedded') {
      console.warn(
        `AnimationController: setupFromModel called for ${this.config.source} source. Use appropriate setup method.`
      );
    }

    let animations = (model as THREE.Object3D & { animations?: THREE.AnimationClip[] }).animations || [];

    // Try parent if no animations on model itself
    if (!animations.length && model.parent) {
      animations = (model.parent as THREE.Object3D & { animations?: THREE.AnimationClip[] }).animations || [];
    }

    if (!animations.length) {
      console.warn(`AnimationController: No animations found for ${this.config.entityType}`);
      return;
    }

    this.mixer = new THREE.AnimationMixer(model);
    this.mapClipsToActions(animations);
    this.logMissingAnimations();
  }

  /**
   * Set up animations from a dictionary of clips (FBX separate).
   *
   * @param model - The model to animate
   * @param clips - Dictionary of animation clips by key
   */
  setupFromClips(model: THREE.Object3D, clips: AnimationClipDict): void {
    if (this.config.source !== 'fbx-separate') {
      console.warn(
        `AnimationController: setupFromClips called for ${this.config.source} source.`
      );
    }

    this.mixer = new THREE.AnimationMixer(model);

    for (const [key, clip] of Object.entries(clips)) {
      const actionName = this.config.clipMatcher(key);
      if (actionName && !this.actions.has(actionName)) {
        const action = this.mixer.clipAction(clip);
        this.actions.set(actionName, action);
      }
    }

    this.logMissingAnimations();
  }

  /**
   * Set up animations from an indexed array (legacy weapon pattern).
   *
   * @param model - The model to animate
   * @param animations - Array of animation clips
   */
  setupFromIndex(model: THREE.Object3D, animations: THREE.AnimationClip[]): void {
    if (this.config.source !== 'index-based') {
      console.warn(
        `AnimationController: setupFromIndex called for ${this.config.source} source.`
      );
    }

    if (!this.config.indexMappings) {
      console.error(
        `AnimationController: indexMappings not defined for ${this.config.entityType}`
      );
      return;
    }

    this.mixer = new THREE.AnimationMixer(model);

    for (const [index, actionName] of Object.entries(this.config.indexMappings)) {
      const idx = parseInt(index, 10);
      if (idx < animations.length) {
        const action = this.mixer.clipAction(animations[idx]);
        this.actions.set(actionName, action);
      }
    }

    this.logMissingAnimations();
  }

  /**
   * Map animation clips to standard action names using the clip matcher.
   */
  private mapClipsToActions(clips: THREE.AnimationClip[]): void {
    if (!this.mixer) return;

    for (const clip of clips) {
      const actionName = this.config.clipMatcher(clip.name);
      if (actionName && !this.actions.has(actionName)) {
        const action = this.mixer.clipAction(clip);
        this.actions.set(actionName, action);
      }
    }
  }

  /**
   * Log warnings for missing required animations.
   */
  private logMissingAnimations(): void {
    const required: AnimationActionName[] = ['idle', 'run', 'die'];

    for (const name of required) {
      if (!this.actions.has(name) && !this.config.fallbacks[name]) {
        console.warn(
          `AnimationController: Missing required animation '${name}' for ${this.config.entityType}`
        );
      }
    }
  }

  /**
   * Play an animation with optional configuration.
   *
   * @param name - The animation action name to play
   * @param options - Play options (loop, crossfade, timeScale)
   * @returns true if animation was played, false if not found
   */
  play(name: AnimationActionName, options: AnimationPlayOptions = {}): boolean {
    const opts = { ...DEFAULT_PLAY_OPTIONS, ...options };

    // Try to get the action, with fallback support
    let action = this.actions.get(name);

    if (!action && this.config.fallbacks[name]) {
      const fallbackName = this.config.fallbacks[name]!;
      action = this.actions.get(fallbackName);
      if (action) {
        console.debug(
          `AnimationController: Using fallback '${fallbackName}' for '${name}'`
        );
      }
    }

    if (!action) {
      console.warn(
        `AnimationController: Animation '${name}' not found for ${this.config.entityType}`
      );
      return false;
    }

    // Configure action
    action.setLoop(opts.loop ? THREE.LoopRepeat : THREE.LoopOnce, Infinity);
    action.clampWhenFinished = opts.clampWhenFinished || !opts.loop;
    action.timeScale = opts.timeScale;

    // Crossfade from current action
    if (this.currentAction && this.currentAction !== action) {
      action.reset();
      action.crossFadeFrom(this.currentAction, opts.crossFadeDuration, true);
    }

    action.play();
    this.currentAction = action;
    return true;
  }

  /**
   * Play animation with boolean loop parameter (legacy compatibility).
   */
  playAnimation(name: AnimationActionName, loop: boolean = true): boolean {
    return this.play(name, {
      loop,
      clampWhenFinished: !loop,
    });
  }

  /**
   * Stop all animations.
   */
  stopAll(): void {
    this.mixer?.stopAllAction();
    this.currentAction = null;
  }

  /**
   * Get the current animation action.
   */
  getCurrentAction(): THREE.AnimationAction | null {
    return this.currentAction;
  }

  /**
   * Get the current animation name.
   */
  getCurrentAnimationName(): AnimationActionName | null {
    if (!this.currentAction) return null;

    for (const [name, action] of this.actions) {
      if (action === this.currentAction) {
        return name;
      }
    }
    return null;
  }

  /**
   * Update the animation mixer. Call this every frame.
   *
   * @param deltaTime - Time since last frame in seconds
   */
  update(deltaTime: number): void {
    this.mixer?.update(deltaTime);
  }

  /**
   * Dispose of the animation mixer and actions.
   */
  dispose(): void {
    this.mixer?.stopAllAction();
    this.actions.clear();
    this.currentAction = null;
    this.mixer = null;
  }

  /**
   * Add an event listener to the mixer.
   */
  addEventListener(
    type: 'finished' | 'loop',
    listener: (event: THREE.Event & { action: THREE.AnimationAction }) => void
  ): void {
    this.mixer?.addEventListener(type, listener as (event: THREE.Event) => void);
  }

  /**
   * Remove an event listener from the mixer.
   */
  removeEventListener(
    type: 'finished' | 'loop',
    listener: (event: THREE.Event & { action: THREE.AnimationAction }) => void
  ): void {
    this.mixer?.removeEventListener(type, listener as (event: THREE.Event) => void);
  }
}
