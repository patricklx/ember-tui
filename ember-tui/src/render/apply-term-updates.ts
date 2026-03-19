/**
 * Render function for Ember Tui
 * Renders components to terminal output using layout-based rendering
 */

import ElementNode from "../dom/nodes/ElementNode";
import { extractLines } from "./collect-lines";
import { DocumentNode } from "../index";
import * as Process from "node:process";
import { clearEntireLine, clearLineFromCursor, clearLineToStart, moveCursorTo, setProcess } from "./helpers";

// Re-export helper functions for testing
export { clearEntireLine, clearLineFromCursor, clearLineToStart };

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
	scrollBufferSize: number;
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
	scrollBufferSize: 0,
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
	isAnsiOnly?: boolean;
}

/**
 * Represents a rectangular region of the screen that needs updating
 */
interface DirtyRegion {
	x: number;      // Column start (0-based)
	y: number;      // Row start (0-based)
	width: number;  // Number of columns
	height: number; // Number of rows
}

/**
 * Tracks and manages dirty regions for efficient screen updates
 */
class DirtyRegionTracker {
	private regions: DirtyRegion[] = [];

	/**
	 * Mark a region as dirty (needs redrawing)
	 */
	markDirty(x: number, y: number, width: number, height: number): void {
		if (width <= 0 || height <= 0) return;

		this.regions.push({ x, y, width, height });
	}

	/**
	 * Mark an entire line as dirty
	 */
	markLineDirty(line: number, width: number): void {
		this.markDirty(0, line, width, 1);
	}

	/**
	 * Get all dirty regions, merged to minimize updates
	 */
	getDirtyRegions(): DirtyRegion[] {
		if (this.regions.length === 0) return [];

		// Sort regions by y, then x for efficient merging
		const sorted = [...this.regions].sort((a, b) => {
			if (a.y !== b.y) return a.y - b.y;
			return a.x - b.x;
		});

		const merged: DirtyRegion[] = [];
		let current = sorted[0];

		for (let i = 1; i < sorted.length; i++) {
			const next = sorted[i];

			if (this.shouldMerge(current, next)) {
				current = this.merge(current, next);
			} else {
				merged.push(current);
				current = next;
			}
		}
		merged.push(current);

		return merged;
	}

	/**
	 * Clear all dirty regions
	 */
	clear(): void {
		this.regions = [];
	}

	/**
	 * Check if two regions should be merged
	 */
	private shouldMerge(a: DirtyRegion, b: DirtyRegion): boolean {
		// Check if regions overlap or are adjacent
		const aRight = a.x + a.width;
		const aBottom = a.y + a.height;
		const bRight = b.x + b.width;
		const bBottom = b.y + b.height;

		// Horizontal overlap/adjacency
		const horizontalOverlap = !(aRight < b.x || bRight < a.x);
		const horizontalAdjacent = aRight === b.x || bRight === a.x;

		// Vertical overlap/adjacency
		const verticalOverlap = !(aBottom < b.y || bBottom < a.y);
		const verticalAdjacent = aBottom === b.y || bBottom === a.y;

		// Merge if overlapping or adjacent in both dimensions
		return (horizontalOverlap || horizontalAdjacent) &&
		       (verticalOverlap || verticalAdjacent);
	}

	/**
	 * Merge two regions into one bounding region
	 */
	private merge(a: DirtyRegion, b: DirtyRegion): DirtyRegion {
		const x = Math.min(a.x, b.x);
		const y = Math.min(a.y, b.y);
		const right = Math.max(a.x + a.width, b.x + b.width);
		const bottom = Math.max(a.y + a.height, b.y + b.height);

		return {
			x,
			y,
			width: right - x,
			height: bottom - y
		};
	}
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
				start: startIndex,
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

	// eslint-disable-next-line @typescript-eslint/no-unused-vars
	private handleTrailingContent(_maxVisualLength: number): void {
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
// eslint-disable-next-line @typescript-eslint/no-unused-vars
function expandTabs(text: string, _startColumn: number = 0, tabWidth: number = 8): string {
	return text.replace(/\t/g, ' '.repeat(tabWidth));
}

/**
 * Calculate visual length of text (excluding ANSI codes and control characters)
 */
function getVisualLength(text: string): number {
	// Remove control characters like \r and \n before calculating visual length
	const cleanText = text.replace(/[\r\n]/g, '');
	const tokens = tokenize(cleanText);
	return tokens.reduce((sum, token) => sum + token.visualLength, 0);
}

/**
 * Apply minimal update to a line by writing to a buffer instead of stdout
 * Used by dirty region tracking for batched updates
 */
function updateLineMinimalToBuffer(
	buffer: string[],
	line: number,
	oldText: string,
	newText: string,
	region: DirtyRegion
): void {
	// Expand tabs to spaces before processing
	const expandedOldText = expandTabs(oldText);
	const expandedNewText = expandTabs(newText);

	const segments = findDiffSegments(expandedOldText, expandedNewText);

	// If no segments, strings are identical
	if (segments.length === 0) {
		return;
	}

	const oldVisualLength = getVisualLength(expandedOldText);
	const newVisualLength = getVisualLength(expandedNewText);

	// Helper to add cursor movement to buffer
	const addCursorMove = (col: number, row: number) => {
		buffer.push(`\x1b[${row + 1};${col + 1}H`);
	};

	// If new line is empty, clear the region
	if (newVisualLength === 0 && oldVisualLength > 0) {
		addCursorMove(region.x, line);
		buffer.push('\x1b[0K'); // Clear from cursor to end of line
		return;
	}

	// Apply each segment update to buffer
	for (let i = 0; i < segments.length; i++) {
		const segment = segments[i];
		const isLastSegment = i === segments.length - 1;

		// Skip segments outside the dirty region
		if (segment.start < region.x || segment.start >= region.x + region.width) {
			continue;
		}

		// Move cursor to the visual position of the changed segment
		addCursorMove(segment.start, line);

		// Reset any previous styling
		buffer.push('\x1b[0m');

		// Write the new text for this segment
		if (segment.text.length > 0) {
			buffer.push(segment.text);
		}

		// If this is the last segment and new text is shorter, clear to end
		const needsClearRight = isLastSegment && ((newVisualLength < oldVisualLength) || segment.text === '');

		if (needsClearRight) {
			const start = newVisualLength < oldVisualLength ? newVisualLength : segment.start;
			addCursorMove(start, line);
			buffer.push('\x1b[0K'); // Clear from cursor to end of line
		}
	}

	// Reset ANSI codes
	buffer.push('\x1b[0m');
}

/**
 * Apply minimal update to a line by only rewriting the changed portions
 * Uses write batching to minimize flicker by accumulating all operations
 * and writing them in a single stdout.write() call
 */
function updateLineMinimal(line: number, oldText: string, newText: string): void {
	// Expand tabs to spaces before processing
	const expandedOldText = expandTabs(oldText);
	const expandedNewText = expandTabs(newText);

	const segments = findDiffSegments(expandedOldText, expandedNewText);

	// If no segments, strings are identical
	if (segments.length === 0) {
		return;
	}

	const oldVisualLength = getVisualLength(expandedOldText);
	const newVisualLength = getVisualLength(expandedNewText);

	// Write buffer to accumulate all operations
	const buffer: string[] = [];

	// Helper to add cursor movement to buffer
	const addCursorMove = (col: number, row: number) => {
		buffer.push(`\x1b[${row + 1};${col + 1}H`);
	};

	// If new line is empty, clear the entire line and return
	if (newVisualLength === 0 && oldVisualLength > 0) {
		addCursorMove(0, line);
		buffer.push('\x1b[2K'); // Clear entire line
		process.stdout.write(buffer.join(''));
		return;
	}

	// Apply each segment update
	for (let i = 0; i < segments.length; i++) {
		const segment = segments[i];
		const isFirstSegment = i === 0;
		const isLastSegment = i === segments.length - 1;

		// Move cursor to the visual position of the changed segment
		addCursorMove(segment.start, line);

		// Reset any previous styling (background colors, etc.) before writing new content
		buffer.push('\x1b[0m');

		if (isFirstSegment && segment.start > 0) {
			const prevStart = AnsiTokenizer.tokenize(oldText).find(x => !x.isAnsi)?.start || segment.start;
			if (prevStart < segment.start) {
				buffer.push('\x1b[1K'); // Clear from cursor to start of line
			}
		}

		// Write the new text for this segment (including any ANSI codes)
		if (segment.text.length > 0) {
			buffer.push(segment.text);
		}

		// If this is the last segment and new text is visually shorter, clear to end of line
		const needsClearRight = isLastSegment && ((newVisualLength < oldVisualLength) || segment.text === '');

		if (needsClearRight) {
			const start = newVisualLength < oldVisualLength ? newVisualLength : segment.start;
			addCursorMove(start, line);
			buffer.push('\x1b[0K'); // Clear from cursor to end of line
		}
	}

	// Reset ANSI codes at end of line to prevent color bleeding to next line
	buffer.push('\x1b[0m');

	// Single write operation - this is the key to reducing flicker!
	process.stdout.write(buffer.join(''));
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


	const result = extractLines(rootNode, {}, process.stdout);
	const oldLines = state.lines;

	// Calculate scroll buffer offset (lines that have scrolled off screen)
	const scrollBufferSize = Math.max(state.scrollBufferSize, oldLines.length - state.terminalHeight, 0);
	state.scrollBufferSize = scrollBufferSize;

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
			if (state.cursor.state === 'visible') {
				process.stdout.write('\x1b[?25h'); // Show cursor
				moveCursorTo(state.cursor.y, state.cursor.x);
			}
		}
		return;
	}

	// Use dirty region tracking for efficient updates
	const dirtyTracker = new DirtyRegionTracker();

	process.stdout.write('\x1b[?25l'); // Hide cursor

	try {
		// Calculate which lines are visible (after scroll buffer)
		const visibleStartLine = scrollBufferSize;
		const maxLines = Math.max(newLines.length, oldLines.length);

		// First pass: identify all dirty regions
		for (let i = visibleStartLine; i < maxLines; i++) {
			const newLine = newLines[i];
			const oldLine = oldLines[i];

			if (newLine !== oldLine) {
				// Calculate screen position (relative to visible viewport)
				const screenLine = i - scrollBufferSize;

				// Track lines within visible terminal viewport
				if (i >= visibleStartLine) {
					dirtyTracker.markLineDirty(screenLine, state.terminalWidth);
				}
			}
		}

		// Second pass: render dirty regions with batched writes
		const dirtyRegions = dirtyTracker.getDirtyRegions();
		const buffer: string[] = [];

		// Handle lines beyond terminal height (need scrolling)
		const linesNeedingScroll: number[] = [];
		for (let i = state.terminalHeight + scrollBufferSize; i < newLines.length; i++) {
			linesNeedingScroll.push(i);
		}

		for (const region of dirtyRegions) {
			// Process each line in the region
			for (let row = 0; row < region.height; row++) {
				const screenLine = region.y + row;
				const actualLine = screenLine + scrollBufferSize;

				const newLine = newLines[actualLine];
				const oldLine = oldLines[actualLine];

				if (newLine === undefined || newLine === "") {
					// Line was removed - clear it
					buffer.push(`\x1b[${screenLine + 1};1H`); // Move to line start
					buffer.push('\x1b[2K'); // Clear entire line
				} else if (oldLine === undefined || oldLine === "") {
					// New line - just write it
					buffer.push(`\x1b[${screenLine + 1};1H`); // Move to line start
					buffer.push(expandTabs(newLine));
				} else {
					// Line changed - apply minimal segment updates
					updateLineMinimalToBuffer(buffer, screenLine, oldLine, newLine, region);
				}
			}
		}

		// Handle lines that need scrolling (beyond terminal height)
		if (linesNeedingScroll.length > 0) {
			// Move to bottom of screen
			buffer.push(`\x1b[${state.terminalHeight};1H`);

			// Write each line that needs scrolling with newline
			for (const lineIndex of linesNeedingScroll) {
				buffer.push('\n');
				buffer.push(expandTabs(newLines[lineIndex]));
			}
		}

		// Single write for all updates
		if (buffer.length > 0) {
			process.stdout.write(buffer.join(''));
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
	state.scrollBufferSize = 0;
}

/**
 * Handle terminal resize
 */
export function handleResize(document: DocumentNode): void {
	clearScreen();
	if (document.body) {
		render(document.body);
	}
}
