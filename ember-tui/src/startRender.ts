import { _backburner } from "@ember/runloop";
import type { DocumentNode } from "./index";
import { clearScreen, handleResize, render } from "./render/apply-term-updates";

/**
 * Map raw terminal input to standard key names
 */
function mapKeyName(rawKey: string): string {
  // Map escape sequences to key names
  const keyMap: Record<string, string> = {
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
    '\x1b[Z': 'Tab', // Shift+Tab
    '\x1b': 'Escape',
    '\r': 'Enter',
    '\n': 'Enter',
    '\t': 'Tab',
    '\x7f': 'Backspace',
    '\b': 'Backspace',
    ' ': 'Space',
    '\x0c': 'Clear',
  };

  return keyMap[rawKey] || rawKey;
}

/**
 * Detect if a character is a shifted version
 */
function isShiftedChar(char: string): boolean {
  // Uppercase letters
  if (char.length === 1 && char >= 'A' && char <= 'Z') {
    return true;
  }
  // Shifted symbols
  const shiftedSymbols = '~!@#$%^&*()_+{}|:"<>?';
  return shiftedSymbols.includes(char);
}


/**
 * Render a Glimmer component to the terminal
 */
export function startRender(
  document: DocumentNode,
): void {
  // Initial clear and render
  clearScreen();
  
  // Force immediate render
  render(document.body!);
  
  // Force flush to ensure output is written
  if (process.stdout && typeof (process.stdout as any).flush === 'function') {
    (process.stdout as any).flush();
  }

  // Set up reactive rendering on backburner end
  _backburner.on('end', () => render(document.body!));

  const stdout = process.stdout;
  const stdin = process.stdin;

  // Set up raw mode for input (only if stdin is a TTY)
  if (stdin.isTTY && typeof stdin.setRawMode === 'function') {
    stdin.setRawMode(true);
    stdin.resume();
    stdin.setEncoding('utf8');

    // Handle keyboard input - only when stdin is a TTY
    stdin.on('data', function(keyBuffer){
      const rawInput = keyBuffer.toString();

      // Detect Shift+Tab (\x1b[Z)
      const isShiftTab = rawInput === '\x1b[Z';
      
      // Detect Alt+ key combinations
      // Alt+key produces escape sequence: \x1b followed by the key
      const isAlt = rawInput.length === 2 && rawInput[0] === '\x1b' && rawInput[1] !== '[';
      
      // Detect Ctrl+ key combinations
      // Ctrl+key produces ASCII codes 1-26 (Ctrl+A = 1, Ctrl+B = 2, etc.)
      // Note: Some keys are ambiguous in terminals:
      // - Ctrl+I and Tab both produce \t (ASCII 9)
      // - Ctrl+M and Enter both produce \r (ASCII 13)
      // - Ctrl+J and Newline both produce \n (ASCII 10)
      const charCode = rawInput.charCodeAt(0);
      const isCtrl = charCode >= 1 && charCode <= 26 && rawInput !== '\r' && rawInput !== '\n' && rawInput !== '\t';
      
      // Check for ambiguous keys (could be either Tab/Ctrl+I, Enter/Ctrl+M, etc.)
      const isAmbiguous = rawInput === '\t' || rawInput === '\r' || rawInput === '\n';
      
      // Check for special keys that should use their mapped names
      // (Backspace, Delete, Escape, Arrow keys, etc.)
      const mappedName = mapKeyName(rawInput);
      const isSpecialKey = mappedName !== rawInput && 
        (rawInput.startsWith('\x1b') || // Escape sequences
         rawInput === '\x7f' ||          // Backspace (DEL)
         rawInput === '\b' ||            // Backspace
         rawInput === ' ');              // Space
      
      // Detect Shift modifier
      const isShift = isShiftTab || (rawInput.length === 1 && isShiftedChar(rawInput));
      
      // Determine the actual key character and the base key
      let key: string;           // The actual character typed (e.g., '@', 'A', 'a', 'Tab', 'Enter')
      let code: string;          // The key name/code (e.g., 'Digit2', 'KeyA', 'Tab')
      
      if (isAlt) {
        // Alt+key: preserve the character after escape
        key = rawInput[1];
        code = mapKeyName(key);
      } else if (isCtrl) {
        // Ctrl+key: provide both the control character and the base letter
        const baseLetter = String.fromCharCode(charCode + 96);
        key = rawInput;  // Keep the actual control character
        code = baseLetter;  // Provide the base letter for reference
      } else if (isAmbiguous || isSpecialKey) {
        // Ambiguous or special keys: use the mapped name for clarity
        // e.g., '\t' becomes 'Tab', '\x7f' becomes 'Backspace', '\x1b[A' becomes 'ArrowUp'
        key = mappedName;
        code = mappedName;
      } else {
        // Regular printable character
        key = rawInput;
        code = mappedName;
      }

      // Dispatch keydown event to document
      const event = {
        type: 'keydown',
        key: key,           // The actual character/input (e.g., '@', '\x01')
        code: code,         // The mapped key name (e.g., 'Digit2', 'a', 'Tab')
        rawInput: rawInput, // The raw terminal input for debugging
        keyCode: rawInput.charCodeAt(0),
        ctrlKey: isCtrl,
        altKey: isAlt,
        shiftKey: isShift,
        // Note: When ambiguous is true, this could be either:
        // - Tab key OR Ctrl+I (both produce \t)
        // - Enter key OR Ctrl+M (both produce \r)
        ambiguous: isAmbiguous,
        preventDefault: () => {},
        stopPropagation: () => {}
      };
      document.dispatchEvent(event);
    });
  }

  // Handle terminal resize
  stdout.on('resize', () => {
    handleResize(document);
    // Dispatch resize event to document
    const event = {
      type: 'resize',
      preventDefault: () => {},
      stopPropagation: () => {}
    };
    document.dispatchEvent(event);
  });
}
