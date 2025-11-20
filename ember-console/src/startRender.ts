/**
 * Render function for Ember-Ink
 * Renders Glimmer components to terminal output
 */

import TerminalDocumentNode from './dom/nodes/TerminalDocumentNode';
import { _backburner } from "@ember/runloop";
import { elementIterator } from "./dom/nodes/DocumentNode";
import { TerminaTextElement } from "./dom/native-elements/TerminaTextElement";
import { DocumentNode } from "./index";
import * as process from "node:process";
import ElementNode from "./dom/nodes/ElementNode";
import * as readline from "node:readline";

export interface RenderOptions {
  /**
   * Output stream where app will be rendered.
   * @default process.stdout
   */
  stdout?: NodeJS.WriteStream;

  /**
   * Input stream where app will listen for input.
   * @default process.stdin
   */
  stdin?: NodeJS.ReadStream;

  /**
   * Error stream.
   * @default process.stderr
   */
  stderr?: NodeJS.WriteStream;
}

export interface RenderInstance {
  /**
   * The root document node
   */
  document: TerminalDocumentNode;

  /**
   * Unmount the app
   */
  unmount: () => void;

  /**
   * Clear the terminal output
   */
  clear: () => void;
}

interface RenderState {
  lines: string[];
  terminalHeight: number;
  terminalWidth: number;
  scrollOffset: number;
}

const state: RenderState = {
  lines: [],
  terminalHeight: process.stdout.rows || 24,
  terminalWidth: process.stdout.columns || 80,
  scrollOffset: 0
};

/**
 * Move cursor to specific line (0-based)
 */
function moveCursorTo(line: number): void {
  readline.cursorTo(process.stdout, 0, line);
}

/**
 * Clear from cursor to end of line
 */
function clearLineFromCursor(): void {
  readline.clearLine(process.stdout, 1); // Clear from cursor to end
}

/**
 * Clear entire line
 */
function clearEntireLine(): void {
  readline.clearLine(process.stdout, 0); // Clear entire line
}

/**
 * Extract lines from the document tree
 */
function extractLines(rootNode: ElementNode): string[] {
  const lines: string[] = [];
  for (const node of elementIterator(rootNode)) {
    if (node instanceof TerminaTextElement) {
      lines.push(...node.text.split('\n'));
    }
  }
  return lines;
}

/**
 * Render with line-by-line diffing
 */
function render(rootNode: ElementNode): void {
  const newLines = extractLines(rootNode);
  const oldLines = state.lines;

  // Check if any lines in the scroll buffer (beyond terminal height) have changed
  const needsFullRedraw = newLines.length > state.terminalHeight && 
    oldLines.length > state.terminalHeight &&
    (() => {
      // Check if any line beyond visible area changed
      const scrollBufferStart = state.terminalHeight;
      const maxScrollCheck = Math.min(newLines.length, oldLines.length);
      for (let i = scrollBufferStart; i < maxScrollCheck; i++) {
        if (newLines[i] !== oldLines[i]) {
          return true;
        }
      }
      // Also check if lengths differ in scroll buffer area
      return newLines.length !== oldLines.length && 
             (newLines.length > scrollBufferStart || oldLines.length > scrollBufferStart);
    })();

  // If scroll buffer changed, clear everything and redraw
  if (needsFullRedraw) {
    clearScreen();
    process.stdout.write('\x1b[?25l'); // Hide cursor
    try {
      for (let i = 0; i < newLines.length; i++) {
        if (i > 0) {
          process.stdout.write('\n');
        }
        process.stdout.write(newLines[i]);
      }
      state.lines = newLines;
    } finally {
      process.stdout.write('\x1b[?25h'); // Show cursor
    }
    return;
  }

  // Hide cursor during rendering for smoother updates
  process.stdout.write('\x1b[?25l');

  try {
    // Diff and update only changed lines
    const maxLines = Math.max(newLines.length, oldLines.length);

    for (let i = 0; i < maxLines; i++) {
      const newLine = newLines[i];
      const oldLine = oldLines[i];

      if (newLine !== oldLine) {
        // For lines within terminal height, use cursor positioning
        // For lines beyond, let terminal naturally scroll
        if (i < state.terminalHeight) {
          moveCursorTo(i);
        } else {
          // Beyond terminal height - just write newline and content
          process.stdout.write('\n');
        }

        if (newLine === undefined) {
          // Line was removed - clear it
          clearEntireLine();
        } else if (oldLine === undefined) {
          // New line - just write it
          process.stdout.write(newLine);
        } else {
          // Line changed - clear and rewrite
          clearEntireLine();
          process.stdout.write(newLine);
        }
      }
    }

    // Clear any extra lines from previous render (only within terminal bounds)
    if (oldLines.length > newLines.length) {
      const linesToClear = Math.min(oldLines.length, state.terminalHeight);
      for (let i = newLines.length; i < linesToClear; i++) {
        moveCursorTo(i);
        clearEntireLine();
      }
    }

    // Update state with all lines (not just visible ones)
    state.lines = newLines;

  } finally {
    // Show cursor again
    process.stdout.write('\x1b[?25h');

    // Move cursor to end
    if (newLines.length > 0) {
      const cursorLine = Math.min(newLines.length, state.terminalHeight - 1);
      moveCursorTo(cursorLine);
    }
  }
}

/**
 * Clear the entire screen and reset state
 */
function clearScreen(): void {
  // Clear screen and scrollback buffer
  process.stdout.write('\x1b[2J\x1b[3J\x1b[H');
  state.lines = [];
  state.scrollOffset = 0;
}

/**
 * Handle terminal resize
 */
function handleResize(document: DocumentNode): void {
  const newHeight = process.stdout.rows || 24;
  const newWidth = process.stdout.columns || 80;

  // Check if dimensions actually changed
  if (newHeight !== state.terminalHeight || newWidth !== state.terminalWidth) {
    state.terminalHeight = newHeight;
    state.terminalWidth = newWidth;

    // Clear and force full re-render on resize
    clearScreen();
    // The next render cycle will redraw everything
		render(document.body)
  }
}

/**
 * Render a Glimmer component to the terminal
 */
export function startRender(
  document: DocumentNode
): void {
  // Initial clear and render
  clearScreen();
  render(document.body);

  // Set up reactive rendering on backburner end
  _backburner.on('end', () => render(document.body));

  const stdout = process.stdout;
  const stdin = process.stdin;

  // Set up raw mode for input
  stdin.setRawMode(true);
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
  });

  // Handle terminal resize
  stdout.on('resize', () => handleResize(document));
}
