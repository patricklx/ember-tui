import { describe, test, expect } from 'vitest';
import { findDiffSegments } from '../src/render/apply-term-updates';

describe('updateLineMinimal - background color handling', () => {
	test('should detect when background color is added to existing text', () => {
		const oldText = '\x1b[36mAuto-approve: \x1b[1m\x1b[37moff\x1b[39m\x1b[22m';
		const newText = '\x1b[106m \x1b[36mAuto-approve: \x1b[1m\x1b[37moff\x1b[49m\x1b[39m\x1b[22m';
		
		const segments = findDiffSegments(oldText, newText);
		
		console.log('Old text:', oldText);
		console.log('New text:', newText);
		console.log('Segments found:', segments.length);
		segments.forEach((seg, i) => {
			console.log(`Segment ${i}:`, {
				start: seg.start,
				text: seg.text,
				textLength: seg.text.length
			});
		});
		
		// Should detect differences due to background color addition
		expect(segments.length).toBeGreaterThan(0);
	});

	test('should detect background color in ANSI state', () => {
		const textWithBg = '\x1b[46m \x1b[36mText\x1b[49m\x1b[39m';
		const textWithoutBg = '\x1b[36mText\x1b[39m';
		
		const hasBg = /\x1b\[(4[0-9]|10[0-7])m/.test(textWithBg);
		const noBg = /\x1b\[(4[0-9]|10[0-7])m/.test(textWithoutBg);
		
		expect(hasBg).toBe(true);
		expect(noBg).toBe(false);
	});

	test('should find differences when same text has different background', () => {
		const oldText = 'Hello World';
		const newText = '\x1b[46mHello World\x1b[49m';
		
		const segments = findDiffSegments(oldText, newText);
		
		console.log('Segments for background addition:', segments);
		
		// Should detect the background color as a difference
		expect(segments.length).toBeGreaterThan(0);
	});

	test('should handle complex line with multiple text segments and background overlay', () => {
		// Simulates the actual repro case
		const oldText = '\x1b[36mAuto-approve: \x1b[1m\x1b[37moff\x1b[39m\x1b[22m                                                                  \x1b[36mTokens left: \x1b[1m\x1b[37m100%\x1b[22m\x1b[90m | \x1b[33m💰 $500.18/$500.00 (100.04%)\x1b[90m | \x1b[36mCurrent \x1b[32m💬: $0.00\x1b[39m                                                                  \x1b[35mMode:\x1b[1m\x1b[37mcode\x1b[39m\x1b[22m';
		const newText = '\x1b[106m \x1b[36mAuto-approve: \x1b[1m\x1b[37moff\x1b[39m\x1b[22m                                                                  \x1b[36mTokens left: \x1b[1m\x1b[37m100%\x1b[22m\x1b[90m | \x1b[33m💰 $500.18/$500.00 (100.04%)\x1b[90m | \x1b[36mCurrent \x1b[32m💬: $0.00\x1b[39m                                                                  \x1b[35mMode:\x1b[1m\x1b[37mcode\x1b[49m\x1b[39m\x1b[22m';
		
		const segments = findDiffSegments(oldText, newText);
		
		console.log('\n=== Complex line test ===');
		console.log('Old has bg:', /\x1b\[(4[0-9]|10[0-7])m/.test(oldText));
		console.log('New has bg:', /\x1b\[(4[0-9]|10[0-7])m/.test(newText));
		console.log('Segments found:', segments.length);
		segments.forEach((seg, i) => {
			console.log(`Segment ${i}:`, {
				start: seg.start,
				textPreview: seg.text.substring(0, 50),
				hasBg: /\x1b\[(4[0-9]|10[0-7])m/.test(seg.text)
			});
		});
		
		// Should detect the background color change
		expect(segments.length).toBeGreaterThan(0);
		
		// At least one segment should contain background color codes
		const hasBgSegment = segments.some(seg => /\x1b\[(4[0-9]|10[0-7])m/.test(seg.text));
		expect(hasBgSegment).toBe(true);
	});
});
