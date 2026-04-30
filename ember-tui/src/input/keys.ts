/**
 * Terminal keyboard input handling.
 *
 * Parses raw terminal escape sequences / control characters into
 * browser-like KeyboardEvent objects.
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface TerminalKeyEvent {
  type: 'keydown';
  /** The logical key value (e.g. 'a', 'A', 'ArrowUp', 'Enter', '\x01') */
  key: string;
  /** The mapped key name / code (e.g. 'ArrowUp', 'Tab', 'a') */
  code: string;
  /** Raw bytes received from the terminal, useful for debugging */
  rawInput: string;
  keyCode: number;
  ctrlKey: boolean;
  altKey: boolean;
  shiftKey: boolean;
  /**
   * True when the sequence is ambiguous between two keys, e.g.:
   *   \t  → Tab  OR  Ctrl+I
   *   \r  → Enter OR  Ctrl+M
   */
  ambiguous: boolean;
  preventDefault(): void;
  stopPropagation(): void;
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/** Maps raw escape sequences / control characters to standard key names. */
const KEY_MAP: Record<string, string> = {
  '\x1b[A': 'ArrowUp',
  '\x1b[B': 'ArrowDown',
  '\x1b[C': 'ArrowRight',
  '\x1b[D': 'ArrowLeft',
  '\x1b[H': 'Home',
  '\x1b[F': 'End',
  '\x1b[5~': 'PageUp',
  '\x1b[6~': 'PageDown',
  '\x1b[3~': 'Delete',
  '\x1b[2~': 'Insert',
  '\x1b[Z': 'Tab',   // Shift+Tab
  '\x1b': 'Escape',
  '\r': 'Enter',
  '\n': 'Enter',
  '\t': 'Tab',
  '\x7f': 'Backspace',
  '\b': 'Backspace',
  ' ': 'Space',
  '\x0c': 'Clear',
};

function mapKeyName(raw: string): string {
  return KEY_MAP[raw] ?? raw;
}

/** Returns true for characters that imply the Shift key was held. */
function isShiftedChar(char: string): boolean {
  if (char.length === 1 && char >= 'A' && char <= 'Z') return true;
  return '~!@#$%^&*()_+{}|:"<>?'.includes(char);
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Parse a raw terminal input string into a {@link TerminalKeyEvent}.
 *
 * This function assumes the caller has already confirmed the string is **not**
 * a mouse sequence (use `isMouseSequence` from `./mouse` for that check).
 */
export function parseKeySequence(raw: string): TerminalKeyEvent {
  const isShiftTab = raw === '\x1b[Z';

  // Alt+key: ESC followed by a single non-'[' character
  const isAlt = raw.length === 2 && raw[0] === '\x1b' && raw[1] !== '[';

  // Ctrl+key: ASCII 1–26, excluding the ambiguous Tab/Enter/Newline bytes
  const charCode = raw.charCodeAt(0);
  const isCtrl =
    charCode >= 1 && charCode <= 26 &&
    raw !== '\r' && raw !== '\n' && raw !== '\t';

  // Sequences that could represent two different keys
  const isAmbiguous = raw === '\t' || raw === '\r' || raw === '\n';

  const mappedName = mapKeyName(raw);
  const isSpecialKey =
    mappedName !== raw &&
    (raw.startsWith('\x1b') || raw === '\x7f' || raw === '\b' || raw === ' ');

  const isShift =
    isShiftTab || (raw.length === 1 && isShiftedChar(raw));

  let key: string;
  let code: string;

  if (isAlt) {
    key  = raw[1]!;
    code = mapKeyName(key);
  } else if (isCtrl) {
    key  = raw;                                    // actual control character
    code = String.fromCharCode(charCode + 96);     // base letter for reference
  } else if (isAmbiguous || isSpecialKey) {
    key  = mappedName;
    code = mappedName;
  } else {
    key  = raw;
    code = mappedName;
  }

  return {
    type: 'keydown',
    key,
    code,
    rawInput: raw,
    keyCode: charCode,
    ctrlKey: isCtrl,
    altKey: isAlt,
    shiftKey: isShift,
    ambiguous: isAmbiguous,
    preventDefault: () => {},
    stopPropagation: () => {},
  };
}
