import { _backburner } from "@ember/runloop";
import { DocumentNode } from "./index";
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
 * Render a Glimmer component to the terminal
 */
export function startRender(
  document: DocumentNode,
): void {
  // Initial clear and render
  clearScreen();
  render(document.body!);

  // Set up reactive rendering on backburner end
  _backburner.on('end', () => render(document.body!));

  const stdout = process.stdout;
  const stdin = process.stdin;

  // Set up raw mode for input (only if stdin is a TTY)
  if (stdin.isTTY && typeof stdin.setRawMode === 'function') {
    stdin.setRawMode(true);
  }
  stdin.resume();
  stdin.setEncoding('utf8');

  // Handle keyboard input
  stdin.on('data', function(keyBuffer){
    const key = keyBuffer.toString();

    // Ctrl-C to exit
    if (key === '\u0003') {
      // Clean up before exit
      process.stdout.write('\x1b[?25h'); // Show cursor
      process.exit();
    }

    // Detect Alt+ key combinations
    // Alt+key produces escape sequence: \x1b followed by the key
    const isAlt = key.length === 2 && key[0] === '\x1b' && key[1] !== '[';
    
    // Detect Ctrl+ key combinations
    // Ctrl+key produces ASCII codes 1-26 (Ctrl+A = 1, Ctrl+B = 2, etc.)
    // But exclude \r (13) and \n (10) which are Enter/newline
    const charCode = key.charCodeAt(0);
    const isCtrl = charCode >= 1 && charCode <= 26 && key !== '\r' && key !== '\n';
    
    // Extract the actual key (without modifiers)
    let actualKey: string;
    if (isAlt) {
      actualKey = key[1];
    } else if (isCtrl) {
      actualKey = String.fromCharCode(charCode + 96);
    } else {
      actualKey = key;
    }
    
    // Map to standard key name
    const keyName = mapKeyName(actualKey);

    // Dispatch keydown event to document
    const event = {
      type: 'keydown',
      key: keyName,
      keyCode: key.charCodeAt(0),
      ctrlKey: isCtrl,
      altKey: isAlt,
      preventDefault: () => {},
      stopPropagation: () => {}
    };
    document.dispatchEvent(event);
  });

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
