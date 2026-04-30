/**
 * Render function for Ember Tui
 * Renders components to terminal output using layout-based rendering
 */

import type ElementNode from "../dom/nodes/ElementNode";
import { extractLines } from "./collect-lines";
import type { DocumentNode } from "../index";
import type * as Process from "node:process";
import { clearEntireLine, clearLineFromCursor, clearLineToStart, moveCursorTo, setProcess } from "./helpers";
import { tokenize as ansiTokenize, styledCharsFromTokens, styledCharsToString } from '@alcalzone/ansi-tokenize';
import type { StyledChar } from '@alcalzone/ansi-tokenize';
import { appendFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';


// Re-export helper functions for testing
export { clearEntireLine, clearLineFromCursor, clearLineToStart, updateLineMinimal };

let process = globalThis.process;

// Debug logging
const DEBUG_LOG_PATH = join(tmpdir(), 'ember-tui-render-debug.log');
let debugEnabled = false;

function debugLog(message: string, data?: any): void {
	if (!debugEnabled) return;
	
	try {
		const timestamp = new Date().toISOString();
		let logMessage = `[${timestamp}] ${message}`;
		if (data !== undefined) {
			logMessage += '\n' + JSON.stringify(data, null, 2);
		}
		logMessage += '\n---\n';
		appendFileSync(DEBUG_LOG_PATH, logMessage, 'utf-8');
	} catch {
		// Silently fail if logging fails
	}
}

export function enableDebugLogging(): void {
	debugEnabled = true;
	debugLog('=== Debug logging enabled ===');
}

export function disableDebugLogging(): void {
	debugLog('=== Debug logging disabled ===');
	debugEnabled = false;
}

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

interface RenderState {
	lines: string[];
	terminalHeight: number;
	terminalWidth: number;
	scrollOffset: number;
	scrollBufferSize: number;
	cursor: {
		y: number,
		x: number,
		state: 'hidden' | 'visible'
	}
}

const state: RenderState = {
	lines: [],
	terminalHeight: process.stdout.rows ?? 24,
	terminalWidth: process.stdout.columns ?? 80,
	scrollOffset: 0,
	scrollBufferSize: 0,
	cursor: {
		x: 0,
		y: 0,
		state: 'visible'
	}
};

/**
 * Reset the render state - used in tests to prevent stale state between test runs
 */
export function resetState(): void {
	state.lines = [];
	state.scrollOffset = 0;
	state.scrollBufferSize = 0;
}

/** Returns the number of content lines currently above the visible viewport. */
export function getScrollBufferSize(): number {
	return state.scrollBufferSize;
}

// Force flush stdout after writes in non-TTY environments
function flushStdout() {
	// Try multiple methods to flush stdout in non-TTY environments
	const stdout = process.stdout as any;

	// Method 1: Direct _handle flush
	if (typeof stdout._handle?.flush === 'function') {
		stdout._handle.flush();
	}

	// Method 2: Cork/uncork to force flush
	if (typeof stdout.uncork === 'function') {
		stdout.uncork();
	}

	// Method 3: Write empty buffer to trigger flush
	if (!process.stdout.isTTY) {
		process.stdout.write('');
	}

	// Method 4: For Node.js streams, call internal flush
	if (typeof stdout.flush === 'function') {
		stdout.flush();
	}
}


/**
 * Represents a segment of text that needs to be updated
 */
export interface TextSegment {
	start: number;
	text: string;
	isAnsiOnly?: boolean;
}

/**
 * Legacy Token interface for backwards compatibility with tests
 */
export interface Token {
	start: number;
	value: string;
	isAnsi: boolean;
	visualLength: number;
}

/**
 * Tokenize function for backwards compatibility with existing tests
 * Converts @alcalzone/ansi-tokenize tokens to legacy format
 */
export function tokenize(text: string): Token[] {
	const tokens = ansiTokenize(text);
	const result: Token[] = [];
	let visualPos = 0;
	
	for (const token of tokens) {
		if (token.type === 'ansi') {
			result.push({
				start: visualPos,
				value: (token as any).code,
				isAnsi: true,
				visualLength: 0
			});
		} else if (token.type === 'char') {
			result.push({
				start: visualPos,
				value: token.value,
				isAnsi: false,
				visualLength: 1
			});
			visualPos++;
		}
	}
	
	return result;
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
			activeAnsi += token.value;
		}

		currentPos += token.visualLength;
	}

	return activeAnsi;
}

/**
 * Convert StyledChar array to string with ANSI codes
 */
function styledCharsToAnsiString(chars: StyledChar[]): string {
	return styledCharsToString(chars);
}
/**
 * Extract the active ANSI codes for a styled character
 */
function getActiveAnsiCodesFromChar(char: StyledChar): string {
	if (!char.styles || char.styles.length === 0) {
		return '';
	}
	
	return char.styles
		.filter(s => s.type === 'ansi')
		.map(s => (s as any).code)
		.join('');
}

/**
 * Find all segments that differ between old and new text using @alcalzone/ansi-tokenize
 */
export function findDiffSegments(oldText: string, newText: string): TextSegment[] {
	debugLog('findDiffSegments called', { oldText, newText });
	
	// Tokenize both strings using the native @alcalzone tokenizer
	const oldTokens = ansiTokenize(oldText);
	const newTokens = ansiTokenize(newText);
	
	debugLog('Tokens parsed', {
		oldTokens: oldTokens.slice(0, 10),
		newTokens: newTokens.slice(0, 10)
	});
	
	// Convert to styled characters
	const oldChars = styledCharsFromTokens(oldTokens);
	const newChars = styledCharsFromTokens(newTokens);

	debugLog('findDiffSegments chars', {
		oldTextLen: oldChars.length,
		oldTextPreview: oldText.substring(0, 80),
		newTextLen: newChars.length,
		newTextPreview: newText.substring(0, 80),
	});
	debugLog('Styled chars created', {
		oldCharsCount: oldChars.length,
		newCharsCount: newChars.length,
		oldChars: oldChars.slice(0, 10),
		newChars: newChars.slice(0, 10)
	});
	
	const segments: TextSegment[] = [];
	const maxLength = Math.max(oldChars.length, newChars.length);
	
	let currentSegmentStart = -1;
	let currentSegmentChars: StyledChar[] = [];
	let currentSegmentAnsiState = '';
	
	const closeSegment = () => {
		if (currentSegmentStart !== -1 && currentSegmentChars.length > 0) {
			// styledCharsToAnsiString already includes ANSI codes, don't prepend them
			const segmentText = styledCharsToAnsiString(currentSegmentChars);
			segments.push({
				start: currentSegmentStart,
				text: segmentText
			});
			debugLog('Segment closed', {
				start: currentSegmentStart,
				length: currentSegmentChars.length,
				text: segmentText
			});
		}
		currentSegmentStart = -1;
		currentSegmentChars = [];
		currentSegmentAnsiState = '';
	};
	
	for (let i = 0; i < maxLength; i++) {
		const oldChar = oldChars[i];
		const newChar = newChars[i];
		
		const oldAnsi = oldChar ? getActiveAnsiCodesFromChar(oldChar) : '';
		const newAnsi = newChar ? getActiveAnsiCodesFromChar(newChar) : '';
		const oldValue = oldChar?.value ?? '';
		const newValue = newChar?.value ?? '';
		
		// Characters match if both value and ANSI codes are identical
		const charsMatch = oldValue === newValue && oldAnsi === newAnsi;
		
		debugLog(`Char ${i}`, {
			oldValue: JSON.stringify(oldValue),
			newValue: JSON.stringify(newValue),
			oldAnsi: oldAnsi.replace(/\x1b/g, '\\x1b'),
			newAnsi: newAnsi.replace(/\x1b/g, '\\x1b'),
			charsMatch,
			currentSegmentStart,
			currentSegmentCharsLength: currentSegmentChars.length
		});
		
		if (!charsMatch) {
			// Start new segment or continue existing one
			if (currentSegmentStart === -1) {
				currentSegmentStart = i;
				currentSegmentAnsiState = newAnsi;
				if (newChar) {
					currentSegmentChars.push(newChar);
				}
				debugLog(`Started new segment at ${i}`);
			} else if (newAnsi !== currentSegmentAnsiState) {
				// ANSI state changed, close current segment and start new one
				debugLog(`ANSI state changed at ${i}, closing segment`);
				closeSegment();
				currentSegmentStart = i;
				currentSegmentAnsiState = newAnsi;
				if (newChar) {
					currentSegmentChars.push(newChar);
				}
			} else {
				// Continue current segment
				if (newChar) {
					currentSegmentChars.push(newChar);
				}
			}
		} else {
			// Characters match - close segment if we have one
			if (currentSegmentStart !== -1) {
				debugLog(`Chars match at ${i}, closing segment`);
				closeSegment();
			}
		}
	}
	
	// Close any remaining segment
	closeSegment();
	
	// Handle case where new text is shorter - need to clear the rest
	if (oldChars.length > newChars.length) {
		segments.push({
			start: newChars.length,
			text: ''
		});
		debugLog('Added clear segment', { start: newChars.length });
	}
	
	debugLog('findDiffSegments result', {
		segmentCount: segments.length,
		segments: segments.map(s => ({ start: s.start, textLen: s.text.length, textPreview: s.text.replace(/\x1b/g, '\\x1b').substring(0, 40) })),
	});

	return segments;
}

/**
 * Expand tabs to spaces based on column position
 * Tabs move to the next multiple of tabWidth (default 8)
 */
function expandTabs(text: string, tabWidth: number = 8): string {
	return text.replace(/\t/g, ' '.repeat(tabWidth));
}

/**
 * Calculate visual length of text (excluding ANSI codes and control characters)
 */
function getVisualLength(text: string): number {
	// Remove control characters like \r and \n before calculating visual length
	const cleanText = text.replace(/[\r\n]/g, '');
	const tokens = ansiTokenize(cleanText);
	const chars = styledCharsFromTokens(tokens);
	return chars.length;
}

/**
 * Apply minimal update to a line by only rewriting the changed portions
 * Appends operations to the provided buffer array
 */
function updateLineMinimal(line: number, oldText: string, newText: string, buffer: string[]): void {
	debugLog('updateLineMinimal called', { line, oldText, newText });
	
	// Expand tabs to spaces before processing
	const expandedOldText = expandTabs(oldText);
	const expandedNewText = expandTabs(newText);

	const segments = findDiffSegments(expandedOldText, expandedNewText);
	
	debugLog('updateLineMinimal segments', { segments });

	// If no segments, strings are identical
	if (segments.length === 0) {
		debugLog('No segments - texts are identical');
		return;
	}

	const oldVisualLength = getVisualLength(expandedOldText);
	const newVisualLength = getVisualLength(expandedNewText);
	
	debugLog('Visual lengths', { oldVisualLength, newVisualLength });

	// Helper to add cursor movement to buffer
	const addCursorMove = (col: number, row: number) => {
		const escapeSeq = `\x1b[${row + 1};${col + 1}H`;
		buffer.push(escapeSeq);
		debugLog('Cursor move', { col, row, escapeSeq });
	};

	// If new line is empty, clear the entire line and return
	if (newVisualLength === 0 && oldVisualLength > 0) {
		addCursorMove(0, line);
		buffer.push('\x1b[2K'); // Clear entire line
		debugLog('Cleared entire line');
		return;
	}

	// Apply each segment update
	for (let i = 0; i < segments.length; i++) {
		const segment = segments[i];
		const isLastSegment = i === segments.length - 1;

		debugLog('Processing segment', { 
			i, 
			segment: {
				start: segment.start,
				text: segment.text,
				textLength: segment.text.length
			}, 
			isLastSegment 
		});

		// Move cursor to the visual position of the changed segment
		addCursorMove(segment.start, line);

		// Write the new text for this segment (including any ANSI codes)
		if (segment.text.length > 0) {
			buffer.push(segment.text);
			debugLog('Wrote segment text', { 
				text: segment.text,
				textPreview: segment.text.substring(0, 50)
			});
		}

		// If this is the last segment and new text is visually shorter, clear the rest
		const needsClearRight = isLastSegment && ((newVisualLength < oldVisualLength) || segment.text === '');

		if (needsClearRight) {
			const start = newVisualLength < oldVisualLength ? newVisualLength : segment.start;
			const spacesToFill = oldVisualLength - start;
			if (spacesToFill > 0) {
				addCursorMove(start, line);
				buffer.push('\x1b[0K'); // Clear from cursor to end
				debugLog('Cleared right side', { start, spacesToFill });
			}
		}
	}

	// Reset ANSI codes at end of line to prevent color bleeding to next line
	buffer.push('\x1b[0m');
	debugLog('Reset ANSI codes');
}

export function cursorTo(y: number, x: number) {
	Object.assign(state.cursor, {
		x,
		y,
	});
	moveCursorTo(y, x);
}

export function hideCursor() {
	state.cursor.state = 'hidden';
	process.stdout.write('\x1b[?25l');
}

export function showCursor() {
	state.cursor.state = 'visible';
	process.stdout.write('\x1b[?25h');
}

/**
 * Render with line-by-line diffing using layout-based rendering
 */
export function render(rootNode: ElementNode, options?: RenderOptions | typeof Process): void {
	debugLog('render called');
	
	// Support both old API (debugProcess) and new API (options)
	if (options && 'stdout' in options) {
		// New API with RenderOptions
		const stdout = options.stdout || process.stdout;
		const oldProcess = process;
		process = {
			...process,
			stdout: stdout as any,
			stdin: options.stdin || process.stdin,
			stderr: options.stderr || process.stderr,
		} as any;

		// Set process in helpers so they use the fake TTY
		setProcess(process);

		state.terminalHeight = process.stdout.rows;
		state.terminalWidth = process.stdout.columns;

		try {
			renderInternal(rootNode);
		} finally {
			process = oldProcess;
			setProcess(oldProcess);
		}
	} else {
		// Old API with debugProcess or no options
		process = (options as typeof Process) ?? process;
		setProcess(process);
		renderInternal(rootNode);
	}
}

export function renderInternal(rootNode: ElementNode): void {
	debugLog('renderInternal called');
	
	const result = extractLines(rootNode, state, process.stdout);
	const oldLines = state.lines;

	const newLines = [...result.static, ...result.dynamic];
	
	debugLog('Lines extracted', {
		oldLinesCount: oldLines.length,
		newLinesCount: newLines.length,
		oldLines: oldLines.slice(0, 3),
		newLines: newLines.slice(0, 3)
	});

	// Calculate scroll buffer offset based on NEW content size
	// This represents how many lines of NEW content are above the visible viewport
	const scrollBufferSize = Math.max(state.scrollBufferSize, oldLines.length - state.terminalHeight);
	state.scrollBufferSize = scrollBufferSize;
	
	// Check if we need a full redraw:
	// Only check lines in the scroll buffer (before the visible viewport)
	// If any line in scroll buffer changed, we need full redraw
	const needsFullRedraw = oldLines.length === 0 || scrollBufferSize > 0 &&
		(() => {
			// Check only lines in the scroll buffer (0 to scrollBufferSize)
			for (let i = 0; i < scrollBufferSize; i++) {
				if (newLines[i] !== oldLines[i]) {
					return true;
				}
			}
			return false;
		})();

	debugLog('Redraw decision', { needsFullRedraw, scrollBufferSize });

	// If scroll buffer changed, clear everything and redraw
	if (needsFullRedraw) {
		debugLog('Performing full redraw');
		clearScreen();
		state.lines = [];
		try {
			for (let i = 0; i < newLines.length; i++) {
				if (i > 0) {
					process.stdout.write('\n');
				}
				process.stdout.write(expandTabs(newLines[i]));
			}
			state.lines = newLines;
			flushStdout(); // Flush output in non-TTY environments
		} finally {
			if (state.cursor.state === 'visible') {
				process.stdout.write('\x1b[?25h'); // Show cursor
				moveCursorTo(state.cursor.y, state.cursor.x);
			}
		}
		state.scrollBufferSize = 0;
		return;
	}
	
	process.stdout.write('\x1b[?25l'); // Hide cursor
	debugLog('Cursor hidden');

	try {
		// Calculate which lines are visible (after scroll buffer)
		const visibleStartLine = scrollBufferSize;
		const maxLines = Math.max(newLines.length, oldLines.length);

		// Find the last line that will be rendered
		const lastRenderedLineIndex = maxLines - 1;

		// Buffer to accumulate all update operations
		const buffer: string[] = [];

		debugLog('Processing lines', { visibleStartLine, maxLines, lastRenderedLineIndex });

		for (let i = visibleStartLine; i < maxLines; i++) {
			const newLine = newLines[i];
			const oldLine = oldLines[i];

			if (newLine !== oldLine) {
				// Calculate screen position (relative to visible viewport)
				const screenLine = i - scrollBufferSize;

				debugLog('Line differs', { i, screenLine, oldLine, newLine });

				// Only update lines within visible terminal viewport
				if (i >= visibleStartLine && i < state.terminalHeight + scrollBufferSize) {
					if (newLine === undefined || newLine === "") {
						// Line was removed - clear it
						const isLastLine = (i === lastRenderedLineIndex);
						buffer.push(`\x1b[${screenLine + 1};1H`); // Move cursor
						buffer.push(isLastLine ? '\x1b[2K ' : '\x1b[2K'); // Clear entire line, add space for last line
						debugLog('Line removed', { screenLine, isLastLine });
					} else if (oldLine === undefined || oldLine === "") {
						// New line - just write it (expand tabs)
						buffer.push(`\x1b[${screenLine + 1};1H`); // Move cursor
						buffer.push(expandTabs(newLine));
						debugLog('New line added', { screenLine });
					} else {
						// Line changed - apply minimal update
					debugLog('Applying minimal update', { screenLine, oldLine: (oldLine ?? '').substring(0, 100), newLine: (newLine ?? '').substring(0, 100) });
						updateLineMinimal(screenLine, oldLine, newLine, buffer);
					}
				} else if (screenLine >= state.terminalHeight) {
					// Beyond previous content - just write newline and content
					buffer.push(`\x1b[${screenLine + 1};1H`); // Move cursor
					buffer.push('\n');
					if (newLine !== undefined) {
						buffer.push(expandTabs(newLine));
					}
					debugLog('Line beyond viewport', { screenLine });
				}
			}
		}

		// Write all accumulated operations in a single write
		if (buffer.length > 0) {
			const output = buffer.join('');
			debugLog('Writing buffer to stdout', { bufferLength: buffer.length, outputLength: output.length });
			process.stdout.write(output);
		}

		// Update state with all lines (not just visible ones)
		state.lines = newLines;

		// Always flush after render to ensure output is visible in non-TTY mode
		flushStdout();

	} finally {
		// Show cursor again
		if (state.cursor.state === 'visible') {
			process.stdout.write('\x1b[?25h');
			moveCursorTo(state.cursor.y, state.cursor.x);
			debugLog('Cursor shown');
		} else {
			process.stdout.write('\x1b[?25l');
			debugLog('Cursor kept hidden');
		}
	}
}

/**
 * Clear the entire screen and reset state
 */
export function clearScreen(): void {
	debugLog('clearScreen called');
	// Clear screen and scrollback buffer
	// Write even in non-TTY mode for testing purposes
	process.stdout.write('\x1b[2J\x1b[3J\x1b[H');
	flushStdout(); // Flush output in non-TTY environments
	state.lines = [];
	state.scrollOffset = 0;
}

/**
 * Handle terminal resize
 */
export function handleResize(document: DocumentNode): void {
	debugLog('handleResize called');
	const newHeight = process.stdout.rows;
	const newWidth = process.stdout.columns;
	state.terminalHeight = newHeight;
	state.terminalWidth = newWidth;
	state.scrollBufferSize = 0;
	clearScreen();
	if (document.body) {
		render(document.body);
	}
}