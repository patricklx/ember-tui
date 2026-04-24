import { describe, it, expect } from 'vitest';
import Output from '../src/render/Output';

describe('Overlay functionality', () => {
	it('should preserve characters when overlay mode is enabled', () => {
		const output = new Output({ width: 20, height: 10 });

		// Write some initial text
		output.write(0, 0, 'Hello World', { transformers: [] });

		// Write overlay with background color (simulating spaces with background)
		// In overlay mode, this should preserve "Hello World" but add background
		output.write(0, 0, '\x1b[41m           \x1b[0m', { transformers: [], overlay: true });

		const result = output.get();
		
		// The text should still contain the characters "Hello" and "World"
		// even though ANSI codes will be inserted between them
		expect(result.output).toContain('Hello');
		expect(result.output).toContain('World');
		// And should have the red background ANSI code (41m)
		expect(result.output).toContain('\x1b[41m');
	});

	it('should replace characters when overlay mode is disabled', () => {
		const output = new Output({ width: 20, height: 10 });

		// Write some initial text
		output.write(0, 0, 'Hello World', { transformers: [] });

		// Write spaces without overlay mode - should replace the text
		output.write(0, 0, '           ', { transformers: [] });

		const result = output.get();
		
		// The text should NOT contain "Hello World" anymore
		expect(result.output).not.toContain('Hello World');
	});

	it('should only overlay on non-empty characters', () => {
		const output = new Output({ width: 20, height: 10 });

		// Write text with gaps
		output.write(0, 0, 'A   B', { transformers: [] });

		// Overlay background
		output.write(0, 0, '\x1b[42m     \x1b[0m', { transformers: [], overlay: true });

		const result = output.get();
		
		// Should preserve A and B
		expect(result.output).toContain('A');
		expect(result.output).toContain('B');
	});
});
