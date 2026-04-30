import { _backburner } from "@ember/runloop";
import type { DocumentNode } from "./index";
import { clearScreen, handleResize, render } from "./render/apply-term-updates";
import { disableMouseTracking, isMouseSequence, parseMouseSequence } from "./input/mouse";
import { parseKeySequence } from "./input/keys";
import fs from "fs";


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

    // Restore terminal on exit
    const cleanup = () => {
      disableMouseTracking(stdout);
      if (stdin.isTTY && typeof stdin.setRawMode === 'function') {
        stdin.setRawMode(false);
      }
    };
    process.once('exit', cleanup);
    process.once('SIGINT', () => { cleanup(); process.exit(0); });
    process.once('SIGTERM', () => { cleanup(); process.exit(0); });

    // Handle keyboard and mouse input - only when stdin is a TTY
    stdin.on('data', function(keyBuffer){
      const rawInput = keyBuffer.toString();

      // --- Mouse sequences take priority over keyboard handling ---
      if (isMouseSequence(rawInput)) {
        const mouseEvent = parseMouseSequence(rawInput);
        if (mouseEvent) {
          fs.appendFileSync('mouse.txt', JSON.stringify(mouseEvent, null, 2) + '\n')
          document.dispatchEvent(mouseEvent);
          // Synthesise a click event on left-button release (button 0)
          if (mouseEvent.type === 'mouseup' && mouseEvent.button === 0) {
            document.dispatchEvent({
              ...mouseEvent,
              type: 'click' as const,
            });
          }
        }
        return;
      }

      document.dispatchEvent(parseKeySequence(rawInput));
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
