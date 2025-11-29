import * as readline from "node:readline";

let process = globalThis.process;

/**
 * Set the process object to use for output
 * This allows tests to inject a fake TTY
 */
export function setProcess(proc: typeof globalThis.process): void {
	process = proc;
}

/**
 * Move cursor to specific line (0-based)
 */
export function moveCursorTo(line: number, row: number = 0): void {
	const stdout = process.stdout as any;
	if (stdout.cursorTo) {
		stdout.cursorTo(row, line);
	} else {
		readline.cursorTo(stdout, row, line);
	}
}

/**
 * Clear from cursor to end of line
 */
export function clearLineFromCursor(): void {
	const stdout = process.stdout as any;
	if (stdout.clearLine) {
		stdout.clearLine(1);
	} else {
		readline.clearLine(stdout, 1); // Clear from cursor to end
	}
}

/**
 * Clear from cursor to start of line
 */
export function clearLineToStart(): void {
	const stdout = process.stdout as any;
	if (stdout.clearLine) {
		stdout.clearLine(-1);
	} else {
		readline.clearLine(stdout, -1); // Clear from cursor to start
	}
}

/**
 * Clear entire line
 */
export function clearEntireLine(): void {
	const stdout = process.stdout as any;
	if (stdout.clearLine) {
		stdout.clearLine(0);
	} else {
		readline.clearLine(stdout, 0); // Clear entire line
	}
}
