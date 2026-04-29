import { describe, it, expect } from 'vitest';
import { styledCharsFromTokens, tokenize } from '@alcalzone/ansi-tokenize';
import Output from '../src/render/Output';

// ─── Helpers ────────────────────────────────────────────────────────────────

/** Return the StyledChar at column `x` of row `y` from an Output.get() result */
function charAt(output: string, x: number, y: number) {
	const lines = output.split('\n');
	if (y >= lines.length) return null;
	const chars = styledCharsFromTokens(tokenize(lines[y]));
	return chars[x] ?? null;
}

/** True if the character at (x, y) has any ANSI background-color style */
function hasBgAt(output: string, x: number, y: number): boolean {
	const ch = charAt(output, x, y);
	if (!ch) return false;
	const isBg = (code: string) => /\x1b\[(4[0-9]|10[0-7]|48;[25];[\d;]+)m/.test(code);
	return ch.styles.some((s: any) => s.type === 'ansi' && isBg(s.code));
}

/** Background ANSI code string at (x, y), or '' if none */
function bgCodeAt(output: string, x: number, y: number): string {
	const ch = charAt(output, x, y);
	if (!ch) return '';
	const isBg = (code: string) => /\x1b\[(4[0-9]|10[0-7]|48;[25];[\d;]+)m/.test(code);
	const match = ch.styles.find((s: any) => s.type === 'ansi' && isBg(s.code));
	return (match as any)?.code ?? '';
}

// ─── Existing basic tests ────────────────────────────────────────────────────

describe('Overlay functionality', () => {
	it('should preserve characters when overlay mode is enabled', () => {
		const output = new Output({ width: 20, height: 10 });

		output.write(0, 0, 'Hello World', { transformers: [] });
		output.write(0, 0, '\x1b[41m           \x1b[0m', { transformers: [], overlay: true });

		const result = output.get();
		expect(result.output).toContain('Hello');
		expect(result.output).toContain('World');
		expect(result.output).toContain('\x1b[41m');
	});

	it('should replace characters when overlay mode is disabled', () => {
		const output = new Output({ width: 20, height: 10 });

		output.write(0, 0, 'Hello World', { transformers: [] });
		output.write(0, 0, '           ', { transformers: [] });

		const result = output.get();
		expect(result.output).not.toContain('Hello World');
	});

	it('should only overlay on non-empty characters', () => {
		const output = new Output({ width: 20, height: 10 });

		output.write(0, 0, 'A   B', { transformers: [] });
		output.write(0, 0, '\x1b[42m     \x1b[0m', { transformers: [], overlay: true });

		const result = output.get();
		expect(result.output).toContain('A');
		expect(result.output).toContain('B');
	});

	// ─── Dynamic add ─────────────────────────────────────────────────────────

	describe('dynamic add', () => {
		it('frame without overlay has no background color', () => {
			const output = new Output({ width: 20, height: 5 });
			output.write(0, 0, 'Hello World', { transformers: [] });

			const { output: result } = output.get();
			expect(hasBgAt(result, 0, 0)).toBe(false);
			expect(hasBgAt(result, 5, 0)).toBe(false);
		});

		it('frame with overlay adds background color while preserving text', () => {
			const output = new Output({ width: 20, height: 5 });
			output.write(0, 0, 'Hello World', { transformers: [] });
			// overlay box: red bg (\x1b[41m) covering the first 11 cols
			output.write(0, 0, '\x1b[41m           \x1b[0m', { transformers: [], overlay: true });

			const { output: result } = output.get();

			// background present at every covered column
			for (let x = 0; x < 11; x++) {
				expect(hasBgAt(result, x, 0), `col ${x} should have bg`).toBe(true);
			}
			// text characters preserved
			expect(charAt(result, 0, 0)?.value).toBe('H');
			expect(charAt(result, 6, 0)?.value).toBe('W');
			// no background beyond overlay bounds
			expect(hasBgAt(result, 12, 0)).toBe(false);
		});

		it('adding overlay on a multi-row layout applies bg to every covered row', () => {
			const output = new Output({ width: 20, height: 5 });
			output.write(0, 0, 'Row0', { transformers: [] });
			output.write(0, 1, 'Row1', { transformers: [] });
			output.write(0, 2, 'Row2', { transformers: [] });

			// overlay covers rows 0-1 only
			output.write(0, 0, '\x1b[41m    \x1b[0m', { transformers: [], overlay: true });
			output.write(0, 1, '\x1b[41m    \x1b[0m', { transformers: [], overlay: true });

			const { output: result } = output.get();

			expect(hasBgAt(result, 0, 0)).toBe(true);
			expect(hasBgAt(result, 0, 1)).toBe(true);
			// row 2 was NOT covered
			expect(hasBgAt(result, 0, 2)).toBe(false);
		});
	});

	// ─── Dynamic remove ───────────────────────────────────────────────────────

	describe('dynamic remove', () => {
		it('removing overlay in next frame strips background color', () => {
			// Frame 1: text + overlay bg
			const frame1 = new Output({ width: 20, height: 5 });
			frame1.write(0, 0, 'Hello World', { transformers: [] });
			frame1.write(0, 0, '\x1b[41m           \x1b[0m', { transformers: [], overlay: true });
			const { output: withOverlay } = frame1.get();
			expect(hasBgAt(withOverlay, 0, 0)).toBe(true); // sanity check

			// Frame 2: same text, NO overlay
			const frame2 = new Output({ width: 20, height: 5 });
			frame2.write(0, 0, 'Hello World', { transformers: [] });
			const { output: withoutOverlay } = frame2.get();

			// background removed
			for (let x = 0; x < 11; x++) {
				expect(hasBgAt(withoutOverlay, x, 0), `col ${x} should NOT have bg`).toBe(false);
			}
			// but text still present
			expect(charAt(withoutOverlay, 0, 0)?.value).toBe('H');
			expect(charAt(withoutOverlay, 6, 0)?.value).toBe('W');
		});

		it('removing overlay on multi-row layout strips bg from all previously covered rows', () => {
			// Frame 1: 3 rows of text + 3-row overlay
			const frame1 = new Output({ width: 20, height: 5 });
			for (let row = 0; row < 3; row++) {
				frame1.write(0, row, `Line${row}`, { transformers: [] });
				frame1.write(0, row, '\x1b[44m      \x1b[0m', { transformers: [], overlay: true });
			}
			const { output: withOverlay } = frame1.get();
			for (let row = 0; row < 3; row++) {
				expect(hasBgAt(withOverlay, 0, row)).toBe(true);
			}

			// Frame 2: same text, no overlay
			const frame2 = new Output({ width: 20, height: 5 });
			for (let row = 0; row < 3; row++) {
				frame2.write(0, row, `Line${row}`, { transformers: [] });
			}
			const { output: withoutOverlay } = frame2.get();

			for (let row = 0; row < 3; row++) {
				expect(hasBgAt(withoutOverlay, 0, row), `row ${row} should NOT have bg`).toBe(false);
			}
		});
	});

	// ─── Moving overlay ───────────────────────────────────────────────────────

	describe('moving overlay', () => {
		it('moving overlay horizontally shifts background to new column range', () => {
			const BG = '\x1b[41m'; // red
			const text = 'ABCDEFGHIJ'; // 10 chars

			// Frame 1: overlay at cols 0-4
			const frame1 = new Output({ width: 20, height: 5 });
			frame1.write(0, 0, text, { transformers: [] });
			frame1.write(0, 0, `${BG}     \x1b[0m`, { transformers: [], overlay: true });
			const { output: result1 } = frame1.get();

			for (let x = 0; x < 5; x++) expect(hasBgAt(result1, x, 0), `col ${x} bg in frame1`).toBe(true);
			for (let x = 5; x < 10; x++) expect(hasBgAt(result1, x, 0), `col ${x} no bg in frame1`).toBe(false);

			// Frame 2: overlay moved to cols 5-9
			const frame2 = new Output({ width: 20, height: 5 });
			frame2.write(0, 0, text, { transformers: [] });
			frame2.write(5, 0, `${BG}     \x1b[0m`, { transformers: [], overlay: true });
			const { output: result2 } = frame2.get();

			for (let x = 0; x < 5; x++) expect(hasBgAt(result2, x, 0), `col ${x} no bg in frame2`).toBe(false);
			for (let x = 5; x < 10; x++) expect(hasBgAt(result2, x, 0), `col ${x} bg in frame2`).toBe(true);
		});

		it('moving overlay vertically shifts background to new row', () => {
			const BG = '\x1b[42m'; // green
			const bgLine = `${BG}   \x1b[0m`;

			// Frame 1: overlay on row 0
			const frame1 = new Output({ width: 20, height: 5 });
			frame1.write(0, 0, 'ABC', { transformers: [] });
			frame1.write(0, 1, 'DEF', { transformers: [] });
			frame1.write(0, 0, bgLine, { transformers: [], overlay: true });
			const { output: r1 } = frame1.get();

			expect(hasBgAt(r1, 0, 0)).toBe(true);
			expect(hasBgAt(r1, 0, 1)).toBe(false);

			// Frame 2: overlay moved to row 1
			const frame2 = new Output({ width: 20, height: 5 });
			frame2.write(0, 0, 'ABC', { transformers: [] });
			frame2.write(0, 1, 'DEF', { transformers: [] });
			frame2.write(0, 1, bgLine, { transformers: [], overlay: true });
			const { output: r2 } = frame2.get();

			expect(hasBgAt(r2, 0, 0)).toBe(false);
			expect(hasBgAt(r2, 0, 1)).toBe(true);
		});

		it('moving overlay diagonally updates both row and column', () => {
			const BG = '\x1b[43m'; // yellow
			const bgLine = `${BG}  \x1b[0m`;

			// Frame 1: overlay at (col=0, row=0)
			const frame1 = new Output({ width: 20, height: 5 });
			for (let r = 0; r < 3; r++) frame1.write(0, r, 'XXXX', { transformers: [] });
			frame1.write(0, 0, bgLine, { transformers: [], overlay: true });
			const { output: r1 } = frame1.get();
			expect(hasBgAt(r1, 0, 0)).toBe(true);
			expect(hasBgAt(r1, 0, 2)).toBe(false);
			expect(hasBgAt(r1, 2, 0)).toBe(false);

			// Frame 2: overlay moved to (col=2, row=2)
			const frame2 = new Output({ width: 20, height: 5 });
			for (let r = 0; r < 3; r++) frame2.write(0, r, 'XXXX', { transformers: [] });
			frame2.write(2, 2, bgLine, { transformers: [], overlay: true });
			const { output: r2 } = frame2.get();
			expect(hasBgAt(r2, 0, 0)).toBe(false);
			expect(hasBgAt(r2, 2, 2)).toBe(true);
			expect(hasBgAt(r2, 3, 2)).toBe(true);
		});

		it('overlay color changes when box moves to new position', () => {
			// Frame 1: red overlay at col 0
			const frame1 = new Output({ width: 20, height: 5 });
			frame1.write(0, 0, 'ABCDE', { transformers: [] });
			frame1.write(0, 0, '\x1b[41m  \x1b[0m', { transformers: [], overlay: true });
			const { output: r1 } = frame1.get();
			expect(bgCodeAt(r1, 0, 0)).toContain('41m');

			// Frame 2: blue overlay at col 3 (different color to make it unambiguous)
			const frame2 = new Output({ width: 20, height: 5 });
			frame2.write(0, 0, 'ABCDE', { transformers: [] });
			frame2.write(3, 0, '\x1b[44m  \x1b[0m', { transformers: [], overlay: true });
			const { output: r2 } = frame2.get();
			// old position no longer has red bg
			expect(hasBgAt(r2, 0, 0)).toBe(false);
			// new position has blue bg
			expect(bgCodeAt(r2, 3, 0)).toContain('44m');
			expect(bgCodeAt(r2, 4, 0)).toContain('44m');
		});
	});
});