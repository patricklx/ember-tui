/**
 * Render function for Ember Tui
 * Renders components to terminal output using layout-based rendering
 */

import ElementNode from "../dom/nodes/ElementNode";
import { extractLines } from "./collect-lines.js";
import * as readline from "node:readline";
import { DocumentNode } from "../index.js";
import * as Process from "node:process";
import { clearEntireLine, clearLineFromCursor, clearLineToStart, moveCursorTo, setProcess } from "./helpers";
import * as fs from 'node:fs';

let process = globalThis.process;

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
	cursor: {
		y: number,
		x: number,
		state: 'hidden' | 'visible'
	}
}

const state: RenderState = {
	lines: [],
	terminalHeight: process.stdout.rows || 15,
	terminalWidth: process.stdout.columns || 80,
	scrollOffset: 0,
	cursor: {
		x: 0,
		y: 0,
		state: 'visible'
	}
};


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
	start: number;
	value: string;
	isAnsi: boolean;
	visualLength: number; // 0 for ANSI codes, 1 for regular chars
}

/**
 * Tokenizer class - Separates ANSI parsing logic
 */
class AnsiTokenizer {
	private static readonly ANSI_ESCAPE = '\x1b';
	private static readonly ANSI_START = '[';
	private static readonly ANSI_END_PATTERN = /[a-zA-Z]/;

	static tokenize(text: string): Token[] {
		const tokens: Token[] = [];
		let i = 0;

		let visualStart = 0;

		while (i < text.length) {
			const ansiToken = this.tryParseAnsiSequence(text, i);
			if (ansiToken) {
				tokens.push(ansiToken);
				i += ansiToken.value.length;
			} else {
				tokens.push({
					start: visualStart,
					value: text[i],
					isAnsi: false,
					visualLength: 1
				});
				visualStart += 1;
				i++;
			}
		}

		return tokens;
	}

	private static tryParseAnsiSequence(text: string, startIndex: number): Token | null {
		if (text[startIndex] !== this.ANSI_ESCAPE || text[startIndex + 1] !== this.ANSI_START) {
			return null;
		}

		let endIndex = startIndex + 2;
		while (endIndex < text.length && !this.ANSI_END_PATTERN.test(text[endIndex])) {
			endIndex++;
		}

		if (endIndex < text.length) {
			endIndex++; // Include the final letter
			return {
				value: text.slice(startIndex, endIndex),
				isAnsi: true,
				visualLength: 0
			};
		}

		return null;
	}
}

/**
 * Backwards compatible tokenize function
 */
export function tokenize(text: string): Token[] {
	return AnsiTokenizer.tokenize(text);
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
 * ANSI State Manager - Handles ANSI code state tracking
 */
class AnsiStateManager {
	private static readonly RESET_CODE = '\x1b[0m';

	static extractStateRanges(tokens: Token[]): StateRange[] {
		const builder = new StateRangeBuilder();

		for (const token of tokens) {
			if (token.isAnsi) {
				builder.addAnsiCode(token.value);
			} else {
				builder.addCharacter(token.value);
			}
		}

		return builder.build();
	}
}

/**
 * Builder for constructing state ranges
 */
class StateRangeBuilder {
	private ranges: StateRange[] = [];
	private currentAnsiState = '';
	private currentText = '';
	private currentFullText = '';
	private rangeStart = 0;
	private visualPos = 0;
	private pendingAnsiCodes = '';
	private static readonly RESET_CODE = '\x1b[0m';

	addAnsiCode(code: string): void {
		this.pendingAnsiCodes += code;

		if (code === StateRangeBuilder.RESET_CODE) {
			this.flushCurrentRange();
			this.currentAnsiState = '';
			this.pendingAnsiCodes = '';
		}
	}

	addCharacter(char: string): void {
		if (this.pendingAnsiCodes) {
			this.applyPendingAnsiCodes();
		}

		this.currentText += char;
		this.currentFullText += char;
		this.visualPos++;
	}

	build(): StateRange[] {
		this.flushCurrentRange();
		return this.ranges;
	}

	private applyPendingAnsiCodes(): void {
		if (this.currentText.length > 0) {
			this.flushCurrentRange();
			this.currentAnsiState = this.pendingAnsiCodes;
		} else {
			this.currentAnsiState += this.pendingAnsiCodes;
		}
		this.currentFullText += this.pendingAnsiCodes;
		this.pendingAnsiCodes = '';
	}

	private flushCurrentRange(): void {
		if (this.currentText.length > 0 || this.currentFullText.length > 0) {
			this.ranges.push({
				visualStart: this.rangeStart,
				visualEnd: this.visualPos,
				ansiState: this.currentAnsiState,
				text: this.currentText,
				fullText: this.currentFullText
			});
			this.currentText = '';
			this.currentFullText = '';
			this.rangeStart = this.visualPos;
		}
	}
}

/**
 * Extract ranges from tokens (backwards compatible)
 */
export function extractStateRanges(tokens: Token[]): StateRange[] {
	return AnsiStateManager.extractStateRanges(tokens);
}

/**
 * Diff Segment Builder - Constructs minimal diff segments
 */
class DiffSegmentBuilder {
	private segments: TextSegment[] = [];
	private currentSegmentStart = -1;
	private currentSegmentText = '';
	private currentSegmentAnsiState = '';

	addDifference(visualPos: number, newChar: string | undefined, newState: string): void {
		if (this.currentSegmentStart === -1) {
			this.startNewSegment(visualPos, newState);
		} else if (this.currentSegmentAnsiState !== newState) {
			this.closeAndStartNewSegment(visualPos, newState);
		}

		if (newChar !== undefined) {
			this.currentSegmentText += newChar;
		}
	}

	addMatchingCharacter(visualPos: number, char: string | undefined, hasNextDiffWithSameState: boolean): void {
		if (this.currentSegmentStart !== -1) {
			if (hasNextDiffWithSameState && char !== undefined) {
				this.currentSegmentText += char;
			} else {
				this.closeCurrentSegment();
			}
		}
	}

	closeCurrentSegment(): void {
		if (this.currentSegmentStart !== -1 && this.currentSegmentText.length > 0) {
			this.segments.push({
				start: this.currentSegmentStart,
				text: this.currentSegmentAnsiState + this.currentSegmentText
			});
		}
		this.resetCurrentSegment();
	}

	addEmptySegment(visualPos: number): void {
		this.segments.push({
			start: visualPos,
			text: ''
		});
	}

	addTrailingAnsiSegment(visualPos: number, ansiState: string, trailingAnsi: string): void {
		const existingSegment = this.segments.find(s => s.start === visualPos);
		if (existingSegment) {
			existingSegment.text = ansiState + trailingAnsi;
			existingSegment.isAnsiOnly = true;
		} else {
			this.segments.push({
				start: visualPos,
				text: ansiState + trailingAnsi,
				isAnsiOnly: true,
			});
		}
	}

	build(): TextSegment[] {
		this.closeCurrentSegment();
		return this.segments;
	}

	private startNewSegment(visualPos: number, newState: string): void {
		this.currentSegmentStart = visualPos;
		this.currentSegmentAnsiState = newState;
		this.currentSegmentText = '';
	}

	private closeAndStartNewSegment(visualPos: number, newState: string): void {
		this.closeCurrentSegment();
		this.startNewSegment(visualPos, newState);
	}

	private resetCurrentSegment(): void {
		this.currentSegmentStart = -1;
		this.currentSegmentText = '';
		this.currentSegmentAnsiState = '';
	}
}

/**
 * Range Lookup - Efficient range finding
 */
class RangeLookup {
	constructor(private ranges: StateRange[]) {}

	findRangeAt(visualPos: number): StateRange | undefined {
		return this.ranges.find(r => visualPos >= r.visualStart && visualPos < r.visualEnd);
	}

	getCharAt(visualPos: number): string | undefined {
		const range = this.findRangeAt(visualPos);
		return range ? range.text[visualPos - range.visualStart] : undefined;
	}

	getStateAt(visualPos: number): string {
		const range = this.findRangeAt(visualPos);
		return range ? range.ansiState : '';
	}

	getMaxVisualLength(): number {
		return this.ranges.length > 0 ? this.ranges[this.ranges.length - 1].visualEnd : 0;
	}
}

/**
 * Diff Analyzer - Main diffing logic
 */
class DiffAnalyzer {
	private oldLookup: RangeLookup;
	private newLookup: RangeLookup;
	private builder: DiffSegmentBuilder;

	constructor(oldRanges: StateRange[], newRanges: StateRange[]) {
		this.oldLookup = new RangeLookup(oldRanges);
		this.newLookup = new RangeLookup(newRanges);
		this.builder = new DiffSegmentBuilder();
	}

	analyze(): TextSegment[] {
		const maxVisualLength = Math.max(
			this.oldLookup.getMaxVisualLength(),
			this.newLookup.getMaxVisualLength()
		);

		for (let visualPos = 0; visualPos < maxVisualLength; visualPos++) {
			this.analyzePosition(visualPos, maxVisualLength);
		}

		this.handleTrailingContent(maxVisualLength);

		return this.builder.build();
	}

	private analyzePosition(visualPos: number, maxVisualLength: number): void {
		const oldChar = this.oldLookup.getCharAt(visualPos);
		const newChar = this.newLookup.getCharAt(visualPos);
		const oldState = this.oldLookup.getStateAt(visualPos);
		const newState = this.newLookup.getStateAt(visualPos);

		const positionMatches = oldChar === newChar && oldState === newState;

		if (!positionMatches) {
			this.builder.addDifference(visualPos, newChar, newState);
		} else {
			const hasNextDiffWithSameState = this.lookAheadForNextDiff(visualPos, maxVisualLength, newState);
			this.builder.addMatchingCharacter(visualPos, newChar, hasNextDiffWithSameState);
		}
	}

	private lookAheadForNextDiff(currentPos: number, maxVisualLength: number, currentState: string): boolean {
		for (let lookAhead = currentPos + 1; lookAhead < maxVisualLength; lookAhead++) {
			const nextOldChar = this.oldLookup.getCharAt(lookAhead);
			const nextNewChar = this.newLookup.getCharAt(lookAhead);
			const nextOldState = this.oldLookup.getStateAt(lookAhead);
			const nextNewState = this.newLookup.getStateAt(lookAhead);

			if (nextOldChar !== nextNewChar || nextOldState !== nextNewState) {
				return nextNewState === currentState;
			}
		}
		return false;
	}

	private handleTrailingContent(maxVisualLength: number): void {
		const oldVisualLength = this.oldLookup.getMaxVisualLength();
		const newVisualLength = this.newLookup.getMaxVisualLength();

		if (oldVisualLength > newVisualLength) {
			this.builder.addEmptySegment(newVisualLength);
		}
	}
}

/**
 * Find all segments that differ between old and new text, considering ANSI color codes
 */
export function findDiffSegments(oldText: string, newText: string): TextSegment[] {
	const oldTokens = tokenize(oldText);
	const newTokens = tokenize(newText);

	const oldRanges = extractStateRanges(oldTokens);
	const newRanges = extractStateRanges(newTokens);

	const analyzer = new DiffAnalyzer(oldRanges, newRanges);
	const segments = analyzer.analyze();

	// Handle trailing ANSI codes
	const oldTrailingAnsi = getTrailingAnsi(oldTokens);
	const newTrailingAnsi = getTrailingAnsi(newTokens);

	if (oldTrailingAnsi !== newTrailingAnsi && newTrailingAnsi) {
		const maxVisualLength = Math.max(
			oldRanges.length > 0 ? oldRanges[oldRanges.length - 1].visualEnd : 0,
			newRanges.length > 0 ? newRanges[newRanges.length - 1].visualEnd : 0
		);
		const lastRange = newRanges[newRanges.length - 1];
		const lastAnsiState = lastRange ? lastRange.ansiState : '';

		const builder = new DiffSegmentBuilder();
		segments.forEach(s => builder.addEmptySegment(s.start)); // Preserve existing segments
		builder.addTrailingAnsiSegment(maxVisualLength, lastAnsiState, newTrailingAnsi);

		// Merge with existing segments
		const existingSegment = segments.find(s => s.start === maxVisualLength);
		if (existingSegment) {
			existingSegment.text = lastAnsiState + newTrailingAnsi;
		} else {
			segments.push({
				start: maxVisualLength,
				text: lastAnsiState + newTrailingAnsi
			});
		}
	}

	return segments;
}

/**
 * Get trailing ANSI codes after the last visible character
 */
function getTrailingAnsi(tokens: Token[]): string {
	const lastVisibleIndex = tokens.findLastIndex(t => t.visualLength > 0);
	return tokens
		.slice(lastVisibleIndex + 1)
		.filter(t => t.isAnsi)
		.map(t => t.value)
		.join('');
}

/**
 * Expand tabs to spaces based on column position
 * Tabs move to the next multiple of tabWidth (default 8)
 */
function expandTabs(text: string, startColumn: number = 0, tabWidth: number = 8): string {
	return text.replace(/\t/g, ' '.repeat(tabWidth));
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
	// Expand tabs to spaces before processing
	const expandedOldText = expandTabs(oldText);
	const expandedNewText = expandTabs(newText);

	const segments = findDiffSegments(expandedOldText, expandedNewText);
  fs.appendFileSync('./out.txt', line + JSON.stringify(segments, null, 2));

	// If no segments, strings are identical
	if (segments.length === 0) {
		return;
	}

	const oldVisualLength = getVisualLength(oldText);
	const newVisualLength = getVisualLength(newText);

	// If new line is empty, clear the entire line and return
	if (newVisualLength === 0 && oldVisualLength > 0) {
		const stdout = process.stdout as any;
		if (stdout.cursorTo) {
			stdout.cursorTo(0, line);
		} else {
			readline.cursorTo(stdout, 0, line);
		}
		clearEntireLine();
		return;
	}

	// Apply each segment update
	for (let i = 0; i < segments.length; i++) {
		const segment = segments[i];
		const isFirstSegment = i === 0;
		const isLastSegment = i === segments.length - 1;

		// Move cursor to the visual position of the changed segment
		const stdout = process.stdout as any;
		if (stdout.cursorTo) {
			stdout.cursorTo(segment.start, line);
		} else {
			readline.cursorTo(stdout, segment.start, line);
		}

		// Optimize clearing strategy based on segment position
		const segmentVisualLength = getVisualLength(segment.text);
		const segmentEndPos = segment.start + segmentVisualLength;

		// Reset any previous styling (background colors, etc.) before writing new content
		// This ensures old backgrounds don't persist
		process.stdout.write('\x1b[0m');

		if (isFirstSegment && segment.start > 0) {
			const prevStart = AnsiTokenizer.tokenize(oldText).find(x => !x.isAnsi)?.start || segment.start;
			if (prevStart < segment.start) {
				if (stdout.cursorTo) {
					stdout.cursorTo(segment.start, line);
				} else {
					readline.cursorTo(stdout, segment.start, line);
				}
				clearLineToStart();
			}
		}

		// If this is the last segment and new text is visually shorter, clear to end of line
		// Check if segment is ANSI-only (trailing ANSI codes) - these have 0 visual length
		const needsClearRight = isLastSegment && ((newVisualLength < oldVisualLength) || segment.text === '');

    const start = newVisualLength < oldVisualLength ? newVisualLength: segment.start;

		// Write the new text for this segment (including any ANSI codes)
		if (segment.text.length > 0) {
			process.stdout.write(segment.text);
		}
		if (needsClearRight) {
			if (stdout.cursorTo) {
				stdout.cursorTo(start, line);
			} else {
				readline.cursorTo(stdout, start, line);
			}
			clearLineFromCursor();
		}
	}

	// Reset ANSI codes at end of line to prevent color bleeding to next line
	process.stdout.write('\x1b[0m');
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

function renderInternal(rootNode: ElementNode): void {
	const result = extractLines(rootNode, state, process.stdout);
	const oldLines = state.lines;

	// Calculate scroll buffer offset (lines that have scrolled off screen)
	const scrollBufferSize = Math.max(0, oldLines.length - state.terminalHeight);

	const newLines = [...result.static, ...result.dynamic];
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

	// If scroll buffer changed, clear everything and redraw
	if (needsFullRedraw) {
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
		} finally {
			process.stdout.write('\x1b[?25h'); // Show cursor
		}
		moveCursorTo(state.cursor.y, state.cursor.x);
		return;
	}
	process.stdout.write('\x1b[?25l'); // Hide cursor

	try {
		// Calculate which lines are visible (after scroll buffer)
		const scrollBufferSize = Math.max(0, oldLines.length - state.terminalHeight);
		const visibleStartLine = scrollBufferSize;
		const maxLines = Math.max(newLines.length, oldLines.length);

		for (let i = visibleStartLine; i < maxLines; i++) {
			const newLine = newLines[i];
			const oldLine = oldLines[i];

			if (newLine !== oldLine) {
				// Calculate screen position (relative to visible viewport)
				const screenLine = i - scrollBufferSize;

				// Only update lines within visible terminal viewport
				if (i >= visibleStartLine && i < state.terminalHeight + scrollBufferSize) {
					if (newLine === undefined || newLine === "") {
						// Line was removed - clear it
						moveCursorTo(screenLine);
						clearEntireLine();
					} else if (oldLine === undefined || oldLine === "") {
						// New line - just write it (expand tabs)
						moveCursorTo(screenLine);
						process.stdout.write(expandTabs(newLine));
					} else {
						// Line changed - apply minimal update
						updateLineMinimal(screenLine, oldLine, newLine);
					}
				} else if (screenLine >= state.terminalHeight) {
					// Beyond previous content - just write newline and content
					moveCursorTo(screenLine);
					process.stdout.write('\n');
					if (newLine !== undefined) {
						process.stdout.write(expandTabs(newLine));
					}
				}
			}
		}

		// Update state with all lines (not just visible ones)
		state.lines = newLines;

	} finally {
		// Show cursor again
		if (state.cursor.state === 'visible') {
			process.stdout.write('\x1b[?25h');
			moveCursorTo(state.cursor.y, state.cursor.x);
		} else {
			process.stdout.write('\x1b[?25l');
		}
	}
}

/**
 * Clear the entire screen and reset state
 */
export function clearScreen(): void {
	// Clear screen and scrollback buffer
	process.stdout.write('\x1b[2J\x1b[3J\x1b[H');
	state.lines = [];
	state.scrollOffset = 0;
}

/**
 * Handle terminal resize
 */
export function handleResize(document: DocumentNode): void {
	const newHeight = process.stdout.rows;
	const newWidth = process.stdout.columns;
	state.terminalHeight = newHeight;
	state.terminalWidth = newWidth;
	clearScreen();
	render(document.body);
}
