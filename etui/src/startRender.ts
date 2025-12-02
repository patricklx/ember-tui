import { _backburner } from "@ember/runloop";
import { DocumentNode } from "./index";
import { clearScreen, handleResize, render } from "./render/apply-term-updates";


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

    // Detect Ctrl+ key combinations
    // Ctrl+key produces ASCII codes 1-26 (Ctrl+A = 1, Ctrl+B = 2, etc.)
    // But exclude \r (13) and \n (10) which are Enter/newline
    const charCode = key.charCodeAt(0);
    const isCtrl = charCode >= 1 && charCode <= 26 && key !== '\r' && key !== '\n';
    const actualKey = isCtrl ? String.fromCharCode(charCode + 96) : key;

    // Dispatch keypress event to document
    const event = {
      type: 'keypress',
      key: actualKey,
      keyCode: key.charCodeAt(0),
      ctrlKey: isCtrl,
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
