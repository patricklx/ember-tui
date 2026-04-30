/**
 * Terminal mouse input handling.
 *
 * Enables SGR extended mouse reporting and parses raw escape sequences into
 * browser-like MouseEvent objects.
 *
 * Supported protocols (in order of preference):
 *  - SGR (1006): `\x1b[<Pb;Px;PyM` (press) / `\x1b[<Pb;Px;Pym` (release)
 *  - X10 legacy:  `\x1b[M` followed by 3 raw bytes
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type MouseEventType =
  | 'mousedown'
  | 'mouseup'
  | 'click'
  | 'mousemove'
  | 'wheel';

export interface TerminalMouseEvent {
  type: MouseEventType;
  /** 1-based column (matches terminal coordinates) */
  x: number;
  /** 1-based row (matches terminal coordinates) */
  y: number;
  /** DOM-style button index: 0 = left, 1 = middle, 2 = right, -1 = none/move */
  button: number;
  /** `buttons` bitmask as in browser MouseEvent */
  buttons: number;
  /** Wheel delta: -1 = up, 1 = down, 0 = not a wheel event */
  deltaY: number;
  ctrlKey: boolean;
  altKey: boolean;
  shiftKey: boolean;
  /** Raw escape sequence, useful for debugging */
  rawInput: string;
  preventDefault(): void;
  stopPropagation(): void;
}

// ---------------------------------------------------------------------------
// Enable / disable mouse tracking
// ---------------------------------------------------------------------------

/**
 * Enable mouse tracking in the terminal.
 *  - `?1000` – button-event tracking (press + release)
 *  - `?1002` – button-motion tracking (drag)
 *  - `?1003` – any-event tracking (all movement)
 *  - `?1006` – SGR extended coordinates (handles columns > 223)
 */
export function enableMouseTracking(out: NodeJS.WriteStream): void {
  out.write('\x1b[?1000h'); // button events
  out.write('\x1b[?1002h'); // button-motion (drag)
  out.write('\x1b[?1003h'); // any motion
  out.write('\x1b[?1006h'); // SGR extended mode
}

/**
 * Disable all mouse tracking modes enabled by {@link enableMouseTracking}.
 */
export function disableMouseTracking(out: NodeJS.WriteStream): void {
  out.write('\x1b[?1006l');
  out.write('\x1b[?1003l');
  out.write('\x1b[?1002l');
  out.write('\x1b[?1000l');
}

// ---------------------------------------------------------------------------
// Detection
// ---------------------------------------------------------------------------

/** SGR mouse sequence:  `\x1b[<digits;digits;digits[Mm]` */
const SGR_RE = /^\x1b\[<(\d+);(\d+);(\d+)([Mm])/;

/**
 * Returns `true` when `raw` starts with a recognisable mouse escape sequence.
 */
export function isMouseSequence(raw: string): boolean {
  if (SGR_RE.test(raw)) return true;
  // X10: ESC [ M + exactly 3 bytes
  if (raw.length >= 6 && raw.startsWith('\x1b[M')) return true;
  return false;
}

// ---------------------------------------------------------------------------
// Parsing
// ---------------------------------------------------------------------------

/**
 * Decode the SGR button byte into individual fields.
 *
 * Bit layout (see XTerm documentation):
 *   bits 0-1  button (0=left, 1=middle, 2=right, 3=no-button/motion)
 *   bit  2    shift
 *   bit  3    alt / meta
 *   bit  4    ctrl
 *   bit  5    motion flag (added when pointer is moving)
 *   bit  6    scroll flag (button becomes scroll-up/down)
 */
function decodeSGRButton(pb: number): {
  button: number;
  isMotion: boolean;
  isScroll: boolean;
  shiftKey: boolean;
  altKey: boolean;
  ctrlKey: boolean;
} {
  const rawButton = pb & 0b11;        // bits 0-1
  const shiftKey  = Boolean(pb & 0b0000100);
  const altKey    = Boolean(pb & 0b0001000);
  const ctrlKey   = Boolean(pb & 0b0010000);
  const isMotion  = Boolean(pb & 0b0100000);
  const isScroll  = Boolean(pb & 0b1000000);

  // When the scroll flag is set, button 0 = wheel up, button 1 = wheel down
  let button: number;
  if (isScroll) {
    button = rawButton === 0 ? 0 : 1; // repurposed as scroll direction
  } else if (rawButton === 3) {
    button = -1; // "no button" (motion without a pressed button)
  } else {
    button = rawButton; // 0 = left, 1 = middle, 2 = right
  }

  return { button, isMotion, isScroll, shiftKey, altKey, ctrlKey };
}

/** Build a `buttons` bitmask from a DOM button index (matches browser spec). */
function toButtonsMask(button: number): number {
  if (button === 0) return 1;
  if (button === 1) return 4;
  if (button === 2) return 2;
  return 0;
}

/**
 * Parse a raw terminal input string that contains a mouse escape sequence.
 *
 * Returns `null` when the string cannot be parsed as a mouse event.
 */
export function parseMouseSequence(raw: string): TerminalMouseEvent | null {
  // --- SGR extended mode ---
  const sgrMatch = raw.match(SGR_RE);
  if (sgrMatch) {
    const pb      = parseInt(sgrMatch[1]!, 10);
    const x       = parseInt(sgrMatch[2]!, 10);
    const y       = parseInt(sgrMatch[3]!, 10);
    const isPress = sgrMatch[4] === 'M';

    const { button, isMotion, isScroll, shiftKey, altKey, ctrlKey } =
      decodeSGRButton(pb);

    let type: MouseEventType;
    let deltaY = 0;

    if (isScroll) {
      type   = 'wheel';
      deltaY = button === 0 ? -1 : 1; // 0 = up, 1 = down
    } else if (isMotion || button === -1) {
      // button === -1 means rawButton===3 ("no button held") — pure cursor movement.
      // The motion bit (bit 5) is only set when a button IS held during motion.
      type = 'mousemove';
    } else if (isPress) {
      type = 'mousedown';
    } else {
      // Release – we emit both mouseup and (later) click from startRender
      type = 'mouseup';
    }

    return {
      type,
      x,
      y,
      button: isScroll ? -1 : button,
      buttons: isPress && !isScroll ? toButtonsMask(button) : 0,
      deltaY,
      ctrlKey,
      altKey,
      shiftKey,
      rawInput: raw,
      preventDefault: () => {},
      stopPropagation: () => {},
    };
  }

  // --- X10 / legacy mode: ESC [ M <b> <x> <y> ---
  if (raw.length >= 6 && raw.startsWith('\x1b[M')) {
    const pb = raw.charCodeAt(3) - 32;
    const x  = raw.charCodeAt(4) - 32;
    const y  = raw.charCodeAt(5) - 32;

    const { button, isMotion, isScroll, shiftKey, altKey, ctrlKey } =
      decodeSGRButton(pb);

    let type: MouseEventType;
    let deltaY = 0;

    if (isScroll) {
      type   = 'wheel';
      deltaY = button === 0 ? -1 : 1;
    } else if (isMotion) {
      type = 'mousemove';
    } else if ((pb & 0b11) === 3) {
      // In X10 protocol, button == 3 means "release" (no separate M/m suffix)
      type = 'mouseup';
    } else {
      type = 'mousedown';
    }

    return {
      type,
      x,
      y,
      button: isScroll ? -1 : button,
      buttons: type === 'mousedown' ? toButtonsMask(button) : 0,
      deltaY,
      ctrlKey,
      altKey,
      shiftKey,
      rawInput: raw,
      preventDefault: () => {},
      stopPropagation: () => {},
    };
  }

  return null;
}
