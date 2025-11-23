import * as readline from "node:readline";

/**
 * Move cursor to specific line (0-based)
 */
export function moveCursorTo(line: number): void {
	readline.cursorTo(process.stdout, 0, line);
}

/**
 * Clear from cursor to end of line
 */
export function clearLineFromCursor(): void {
	readline.clearLine(process.stdout, 1); // Clear from cursor to end
}

/**
 * Clear from cursor to start of line
 */
export function clearLineToStart(): void {
	readline.clearLine(process.stdout, -1); // Clear from cursor to start
}

/**
 * Clear entire line
 */
export function clearEntireLine(): void {
	readline.clearLine(process.stdout, 0); // Clear entire line
}
