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
 * Represents a segment of text that needs to be updated
 */
export interface TextSegment {
  start: number;
  text: string;
}

/**
 * Parse text into tokens, treating ANSI escape sequences as single units
 */
export interface Token {
  value: string;
  isAnsi: boolean;
  visualLength: number; // 0 for ANSI codes, 1 for regular chars
}

export function tokenize(text: string): Token[] {
  const tokens: Token[] = [];
  let i = 0;
  
  while (i < text.length) {
    // Check for ANSI escape sequence
    if (text[i] === '\x1b' && text[i + 1] === '[') {
      // Find the end of the ANSI sequence (ends with a letter)
      let j = i + 2;
      while (j < text.length && !/[a-zA-Z]/.test(text[j])) {
        j++;
      }
      if (j < text.length) {
        j++; // Include the final letter
        tokens.push({
          value: text.slice(i, j),
          isAnsi: true,
          visualLength: 0
        });
        i = j;
        continue;
      }
    }
    
    // Regular character
    tokens.push({
      value: text[i],
      isAnsi: false,
      visualLength: 1
    });
    i++;
  }
  
  return tokens;
}

/**
 * Get all active ANSI codes up to a given visual position
 */
export function getActiveAnsiCodes(tokens: Token[], upToVisualPos: number): string {
  let activeAnsi = '';
  let currentPos = 0;
  
  for (const token of tokens) {
    if (currentPos >= upToVisualPos) {
      break;
    }
    
    if (token.isAnsi) {
      // Keep track of the most recent ANSI codes
      activeAnsi += token.value;
    }
    
    currentPos += token.visualLength;
  }
  
  return activeAnsi;
}

/**
 * Represents a range of text with its active ANSI state
 */
interface StateRange {
  visualStart: number;
  visualEnd: number;
  ansiState: string;
  text: string; // The visible text (without ANSI codes)
  fullText: string; // The full text including ANSI codes
}

/**
 * Extract ranges of text grouped by their active ANSI state
 */
export function extractStateRanges(tokens: Token[]): StateRange[] {
  const ranges: StateRange[] = [];
  let currentAnsiState = '';
  let currentText = '';
  let currentFullText = '';
  let rangeStart = 0;
  let visualPos = 0;
  let pendingAnsiCodes = '';
  
  for (const token of tokens) {
    if (token.isAnsi) {
      // Accumulate ANSI codes
      pendingAnsiCodes += token.value;
      
      // Check if this is a reset code
      if (token.value === '\x1b[0m') {
        // Reset clears the state
        if (currentText.length > 0) {
          // Save current range before reset
          ranges.push({
            visualStart: rangeStart,
            visualEnd: visualPos,
            ansiState: currentAnsiState,
            text: currentText,
            fullText: currentFullText
          });
          currentText = '';
          currentFullText = '';
          rangeStart = visualPos;
          currentAnsiState = '';
        }
        // Clear pending codes too
        pendingAnsiCodes = '';
      }
    } else {
      // Regular character - apply any pending ANSI codes
      if (pendingAnsiCodes) {
        if (currentText.length > 0) {
          // ANSI state changed, save previous range
          ranges.push({
            visualStart: rangeStart,
            visualEnd: visualPos,
            ansiState: currentAnsiState,
            text: currentText,
            fullText: currentFullText
          });
          currentText = '';
          currentFullText = '';
          rangeStart = visualPos;
          // Start fresh with new state
          currentAnsiState = pendingAnsiCodes;
        } else {
          // No text yet, just accumulate
          currentAnsiState += pendingAnsiCodes;
        }
        currentFullText += pendingAnsiCodes;
        pendingAnsiCodes = '';
      }
      
      currentText += token.value;
      currentFullText += token.value;
      visualPos += token.visualLength;
    }
  }
  
  // Don't forget the last range
  if (currentText.length > 0 || currentFullText.length > 0) {
    ranges.push({
      visualStart: rangeStart,
      visualEnd: visualPos,
      ansiState: currentAnsiState,
      text: currentText,
      fullText: currentFullText
    });
  }
  
  return ranges;
}

/**
 * Find all segments that differ between old and new text, considering ANSI color codes
 */
export function findDiffSegments(oldText: string, newText: string): TextSegment[] {
  const oldTokens = tokenize(oldText);
  const newTokens = tokenize(newText);
  
  const oldRanges = extractStateRanges(oldTokens);
  const newRanges = extractStateRanges(newTokens);
  
const segments: TextSegment[] = [];
  
  // Build a map of visual positions to ranges for easier comparison
  const maxVisualLength = Math.max(
    oldRanges.length > 0 ? oldRanges[oldRanges.length - 1].visualEnd : 0,
    newRanges.length > 0 ? newRanges[newRanges.length - 1].visualEnd : 0
  );
  
  let currentSegmentStart = -1;
  let currentSegmentText = '';
  let currentSegmentAnsiState = '';
  
  for (let visualPos = 0; visualPos < maxVisualLength; visualPos++) {
    // Find the range that contains this visual position
    const oldRange = oldRanges.find(r => visualPos >= r.visualStart && visualPos < r.visualEnd);
    const newRange = newRanges.find(r => visualPos >= r.visualStart && visualPos < r.visualEnd);
    
    // Get the character at this position
    const oldChar = oldRange ? oldRange.text[visualPos - oldRange.visualStart] : undefined;
    const newChar = newRange ? newRange.text[visualPos - newRange.visualStart] : undefined;
    
    // Get the ANSI state at this position
    const oldState = oldRange ? oldRange.ansiState : '';
    const newState = newRange ? newRange.ansiState : '';
    
    // Check if this position differs
    const charMatches = oldChar === newChar;
    const stateMatches = oldState === newState;
    const positionMatches = charMatches && stateMatches;
    
    if (!positionMatches) {
      // Position differs - start or continue a segment
      if (currentSegmentStart === -1) {
        // Start a new segment
        currentSegmentStart = visualPos;
        currentSegmentAnsiState = newState;
        currentSegmentText = '';
      } else if (currentSegmentAnsiState !== newState) {
        // ANSI state changed within a diff - close current segment and start new one
        segments.push({
          start: currentSegmentStart,
          text: currentSegmentAnsiState + currentSegmentText
        });
        currentSegmentStart = visualPos;
        currentSegmentAnsiState = newState;
        currentSegmentText = '';
      }
      
      // Add the new character to the segment
      if (newChar !== undefined) {
        currentSegmentText += newChar;
      }
    } else {
      // Position matches (both char and state are identical)
      // Close any open segment
      if (currentSegmentStart !== -1) {
        // Only add segment if we have accumulated text
        if (currentSegmentText.length > 0) {
          segments.push({
            start: currentSegmentStart,
            text: currentSegmentAnsiState + currentSegmentText
          });
        }
        currentSegmentStart = -1;
        currentSegmentText = '';
        currentSegmentAnsiState = '';
      }
    }
  }
  
  // Close any remaining segment and check for trailing ANSI codes
  if (currentSegmentStart !== -1) {
    segments.push({
      start: currentSegmentStart,
      text: currentSegmentAnsiState + currentSegmentText
    });
  }
  
  // Check if there are trailing ANSI codes after the last visual character
  // This handles reset codes like \x1b[0m at the end
  const oldTrailingAnsi = oldTokens.slice(oldTokens.findLastIndex(t => t.visualLength > 0) + 1)
    .filter(t => t.isAnsi)
    .map(t => t.value)
    .join('');
  const newTrailingAnsi = newTokens.slice(newTokens.findLastIndex(t => t.visualLength > 0) + 1)
    .filter(t => t.isAnsi)
    .map(t => t.value)
    .join('');
  
  if (oldTrailingAnsi !== newTrailingAnsi && newTrailingAnsi) {
    // Add a segment for the trailing ANSI codes
    const lastRange = newRanges[newRanges.length - 1];
    const lastAnsiState = lastRange ? lastRange.ansiState : '';
    segments.push({
      start: maxVisualLength,
      text: lastAnsiState + newTrailingAnsi
    });
  }
  
  return segments;
}

/**
 * Calculate visual length of text (excluding ANSI codes)
 */
function getVisualLength(text: string): number {
  const tokens = tokenize(text);
  return tokens.reduce((sum, token) => sum + token.visualLength, 0);
}

/**
 * Apply minimal update to a line by only rewriting the changed portions
 */
function updateLineMinimal(line: number, oldText: string, newText: string): void {
  const segments = findDiffSegments(oldText, newText);

  // If no segments, strings are identical
  if (segments.length === 0) {
    return;
  }

  const oldVisualLength = getVisualLength(oldText);
  const newVisualLength = getVisualLength(newText);

  // Apply each segment update
  for (const segment of segments) {
    // Move cursor to the visual position of the changed segment
    readline.cursorTo(process.stdout, segment.start, line);

    // If this is the last segment and new text is visually shorter, clear to end of line
    const isLastSegment = segment === segments[segments.length - 1];
    const segmentVisualLength = getVisualLength(segment.text);
    const needsClear = isLastSegment && (segment.start + segmentVisualLength < oldVisualLength);

    if (needsClear) {
      clearLineFromCursor();
    }

    // Write the new text for this segment (including any ANSI codes)
    if (segment.text.length > 0) {
      process.stdout.write(segment.text);
    } else if (needsClear) {
      // Just clearing, no text to write
    }
  }
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
  const needsFullRedraw = oldLines.length > state.terminalHeight &&
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
          if (newLine === undefined) {
            // Line was removed - clear it
            moveCursorTo(i);
            clearEntireLine();
          } else if (oldLine === undefined) {
            // New line - just write it
            moveCursorTo(i);
            process.stdout.write(newLine);
          } else {
            // Line changed - apply minimal update
            updateLineMinimal(i, oldLine, newLine);
          }
        } else {
          // Beyond terminal height - just write newline and content
          process.stdout.write('\n');
          if (newLine !== undefined) {
            process.stdout.write(newLine);
          }
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

    // Dispatch keypress event to document
    const event = {
      type: 'keypress',
      key: key,
      keyCode: key.charCodeAt(0),
      preventDefault: () => {},
      stopPropagation: () => {}
    };
    document.dispatchEvent(event);
  });

  // Handle terminal resize
  stdout.on('resize', () => handleResize(document));
}
