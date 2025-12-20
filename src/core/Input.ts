/**
 * Input Manager - Singleton
 *
 * Manages keyboard and mouse input state.
 * Provides a unified interface for querying input state.
 */

/**
 * Event listener registration for cleanup.
 */
interface EventRegistration {
  element: EventTarget;
  type: string;
  callback: EventListener;
}

/**
 * Key state map - stores pressed state for each key code.
 */
type KeyMap = Record<string, 0 | 1>;

/**
 * Keyboard key codes used in the game.
 */
export type KeyCode =
  | 'KeyW'
  | 'KeyA'
  | 'KeyS'
  | 'KeyD'
  | 'KeyE'
  | 'KeyR'
  | 'Space'
  | 'ShiftLeft'
  | 'ControlLeft'
  | 'Escape'
  | 'Digit1'
  | 'Digit2'
  | 'Digit3'
  | 'Digit4';

class Input {
  private _keyMap: KeyMap = {};
  private events: EventRegistration[] = [];

  constructor() {
    this.AddKeyDownListener(this._onKeyDown);
    this.AddKeyUpListener(this._onKeyUp);
  }

  /**
   * Internal method to register event listeners with cleanup tracking.
   */
  private _addEventListener(
    element: EventTarget,
    type: string,
    callback: EventListener
  ): void {
    element.addEventListener(type, callback);
    this.events.push({ element, type, callback });
  }

  /**
   * Add a keydown event listener.
   */
  AddKeyDownListener(callback: (event: KeyboardEvent) => void): void {
    this._addEventListener(document, 'keydown', callback as EventListener);
  }

  /**
   * Add a keyup event listener.
   */
  AddKeyUpListener(callback: (event: KeyboardEvent) => void): void {
    this._addEventListener(document, 'keyup', callback as EventListener);
  }

  /**
   * Add a mousemove event listener.
   */
  AddMouseMoveListener(callback: (event: MouseEvent) => void): void {
    this._addEventListener(document, 'mousemove', callback as EventListener);
  }

  /**
   * Add a click event listener.
   */
  AddClickListener(callback: (event: MouseEvent) => void): void {
    this._addEventListener(document.body, 'click', callback as EventListener);
  }

  /**
   * Add a mousedown event listener.
   */
  AddMouseDownListener(callback: (event: MouseEvent) => void): void {
    this._addEventListener(document.body, 'mousedown', callback as EventListener);
  }

  /**
   * Add a mouseup event listener.
   */
  AddMouseUpListener(callback: (event: MouseEvent) => void): void {
    this._addEventListener(document.body, 'mouseup', callback as EventListener);
  }

  /**
   * Add a wheel event listener.
   */
  AddWheelListener(callback: (event: WheelEvent) => void): void {
    this._addEventListener(document.body, 'wheel', callback as EventListener);
  }

  /**
   * Internal keydown handler.
   */
  private _onKeyDown = (event: KeyboardEvent): void => {
    this._keyMap[event.code] = 1;
  };

  /**
   * Internal keyup handler.
   */
  private _onKeyUp = (event: KeyboardEvent): void => {
    this._keyMap[event.code] = 0;
  };

  /**
   * Check if a key is currently pressed.
   *
   * @param code - The key code to check (e.g., 'KeyW', 'Space')
   * @returns 1 if pressed, 0 if not pressed
   */
  GetKeyDown(code: string): 0 | 1 {
    return this._keyMap[code] ?? 0;
  }

  /**
   * Check if a key is pressed (boolean version).
   */
  IsKeyPressed(code: KeyCode): boolean {
    return this._keyMap[code] === 1;
  }

  /**
   * Clear all event listeners except core keyboard handlers.
   * Called when restarting the game.
   */
  ClearEventListeners(): void {
    for (const e of this.events) {
      e.element.removeEventListener(e.type, e.callback);
    }

    this.events = [];
    this._keyMap = {};

    // Re-add core keyboard listeners
    this.AddKeyDownListener(this._onKeyDown);
    this.AddKeyUpListener(this._onKeyUp);
  }

  // Legacy alias for backwards compatibility during migration
  AddKeyDownListner = this.AddKeyDownListener.bind(this);
  AddKeyUpListner = this.AddKeyUpListener.bind(this);
  AddMouseMoveListner = this.AddMouseMoveListener.bind(this);
  AddClickListner = this.AddClickListener.bind(this);
  AddMouseDownListner = this.AddMouseDownListener.bind(this);
  AddMouseUpListner = this.AddMouseUpListener.bind(this);
  ClearEventListners = this.ClearEventListeners.bind(this);
}

// Singleton instance
const inputInstance = new Input();
export default inputInstance;

// Also export the class for testing
export { Input };
