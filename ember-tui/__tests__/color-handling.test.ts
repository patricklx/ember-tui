import { describe, it, expect } from 'vitest';
import { findDiffSegments, tokenize, getActiveAnsiCodes, extractStateRanges } from '../src/render/apply-term-updates';

describe('Color Handling in apply-term-updates', () => {
  describe('tokenize', () => {
    it('should correctly tokenize text with ANSI color codes', () => {
      const text = '\x1b[31mRed\x1b[0m';
      const tokens = tokenize(text);
      
      expect(tokens).toHaveLength(5); // [31m, R, e, d, [0m
      expect(tokens[0].isAnsi).toBe(true);
      expect(tokens[0].value).toBe('\x1b[31m');
      expect(tokens[1].isAnsi).toBe(false);
      expect(tokens[1].value).toBe('R');
    });

    it('should handle multiple color codes in sequence', () => {
      const text = '\x1b[31m\x1b[1mBold Red\x1b[0m';
      const tokens = tokenize(text);
      
      expect(tokens[0].isAnsi).toBe(true);
      expect(tokens[0].value).toBe('\x1b[31m');
      expect(tokens[1].isAnsi).toBe(true);
      expect(tokens[1].value).toBe('\x1b[1m');
    });

    it('should handle background colors', () => {
      const text = '\x1b[44mBlue BG\x1b[0m';
      const tokens = tokenize(text);
      
      expect(tokens[0].isAnsi).toBe(true);
      expect(tokens[0].value).toBe('\x1b[44m');
    });
  });

  describe('getActiveAnsiCodes', () => {
    it('should return active ANSI codes up to position', () => {
      const text = '\x1b[31mRed\x1b[0m';
      const tokens = tokenize(text);
      
      const codes = getActiveAnsiCodes(tokens, 2);
      expect(codes).toBe('\x1b[31m');
    });

    it('should accumulate multiple ANSI codes', () => {
      const text = '\x1b[31m\x1b[1mBold Red\x1b[0m';
      const tokens = tokenize(text);
      
      const codes = getActiveAnsiCodes(tokens, 4);
      expect(codes).toBe('\x1b[31m\x1b[1m');
    });

    it('should handle reset codes', () => {
      const text = '\x1b[31mRed\x1b[0m\x1b[32mGreen';
      const tokens = tokenize(text);
      
      const codesBeforeReset = getActiveAnsiCodes(tokens, 2);
      expect(codesBeforeReset).toBe('\x1b[31m');
      
      const codesAfterReset = getActiveAnsiCodes(tokens, 5);
      expect(codesAfterReset).toBe('\x1b[31m\x1b[0m\x1b[32m');
    });
  });

  describe('extractStateRanges', () => {
    it('should extract state ranges for colored text', () => {
      const text = '\x1b[31mRed\x1b[0m';
      const tokens = tokenize(text);
      const ranges = extractStateRanges(tokens);
      
      expect(ranges).toHaveLength(1);
      expect(ranges[0].ansiState).toBe('\x1b[31m');
      expect(ranges[0].text).toBe('Red');
      expect(ranges[0].visualStart).toBe(0);
      expect(ranges[0].visualEnd).toBe(3);
    });

    it('should handle multiple color changes', () => {
      const text = '\x1b[31mRed\x1b[0m\x1b[32mGreen\x1b[0m';
      const tokens = tokenize(text);
      const ranges = extractStateRanges(tokens);
      
      expect(ranges.length).toBeGreaterThanOrEqual(2);
      expect(ranges[0].ansiState).toBe('\x1b[31m');
      expect(ranges[0].text).toBe('Red');
    });

    it('should handle text with background colors', () => {
      const text = '\x1b[44mBlue BG\x1b[0m';
      const tokens = tokenize(text);
      const ranges = extractStateRanges(tokens);
      
      expect(ranges).toHaveLength(1);
      expect(ranges[0].ansiState).toBe('\x1b[44m');
      expect(ranges[0].text).toBe('Blue BG');
    });
  });

  describe('findDiffSegments - Color Edge Cases', () => {
    it('should detect color change at same position', () => {
      const oldText = '\x1b[31mRed\x1b[0m';
      const newText = '\x1b[34mBlue\x1b[0m';
      
      const segments = findDiffSegments(oldText, newText);
      
      expect(segments.length).toBeGreaterThan(0);
      expect(segments[0].text).toContain('\x1b[34m');
      expect(segments[0].text).toContain('Blue');
    });

    it('should handle color change in middle of text', () => {
      const oldText = 'Hello World';
      const newText = 'Hello \x1b[31mWorld\x1b[0m';
      
      const segments = findDiffSegments(oldText, newText);
      
      expect(segments.length).toBeGreaterThan(0);
      const hasColorCode = segments.some(s => s.text.includes('\x1b[31m'));
      expect(hasColorCode).toBe(true);
    });

    it('should handle removing color from text', () => {
      const oldText = '\x1b[31mRed Text\x1b[0m';
      const newText = 'Red Text';
      
      const segments = findDiffSegments(oldText, newText);
      
      expect(segments.length).toBeGreaterThan(0);
    });

    it('should handle adding color to plain text', () => {
      const oldText = 'Plain Text';
      const newText = '\x1b[32mPlain Text\x1b[0m';
      
      const segments = findDiffSegments(oldText, newText);
      
      expect(segments.length).toBeGreaterThan(0);
      expect(segments[0].text).toContain('\x1b[32m');
    });

    it('should handle background color changes', () => {
      const oldText = '\x1b[44mBlue BG\x1b[0m';
      const newText = '\x1b[41mRed BG\x1b[0m';
      
      const segments = findDiffSegments(oldText, newText);
      
      expect(segments.length).toBeGreaterThan(0);
      expect(segments[0].text).toContain('\x1b[41m');
    });

    it('should handle foreground and background color together', () => {
      const oldText = '\x1b[31m\x1b[44mRed on Blue\x1b[0m';
      const newText = '\x1b[32m\x1b[41mGreen on Red\x1b[0m';
      
      const segments = findDiffSegments(oldText, newText);
      
      expect(segments.length).toBeGreaterThan(0);
      expect(segments[0].text).toContain('\x1b[32m');
      expect(segments[0].text).toContain('\x1b[41m');
    });

    it('should handle partial color change (same text, different color)', () => {
      const oldText = '\x1b[31mABC\x1b[0m';
      const newText = '\x1b[31mA\x1b[0m\x1b[32mBC\x1b[0m';
      
      const segments = findDiffSegments(oldText, newText);
      
      // Should detect that BC changed color
      expect(segments.length).toBeGreaterThan(0);
    });

    it('should handle color bleeding (color not reset)', () => {
      const oldText = '\x1b[31mRed';
      const newText = '\x1b[31mRed\x1b[0m';
      
      const segments = findDiffSegments(oldText, newText);
      
      // Should detect the reset code was added
      expect(segments.length).toBeGreaterThan(0);
    });

    it('should handle trailing ANSI codes', () => {
      const oldText = 'Text\x1b[31m';
      const newText = 'Text\x1b[32m';
      
      const segments = findDiffSegments(oldText, newText);
      
      // Should detect trailing color change
      expect(segments.length).toBeGreaterThan(0);
    });

    it('should handle color change with same visual content', () => {
      const oldText = '\x1b[31mTest\x1b[0m';
      const newText = '\x1b[32mTest\x1b[0m';
      
      const segments = findDiffSegments(oldText, newText);
      
      // Visual content is same but color changed
      expect(segments.length).toBeGreaterThan(0);
      expect(segments[0].start).toBe(0);
      expect(segments[0].text).toContain('\x1b[32m');
      expect(segments[0].text).toContain('Test');
    });

    it('should handle multiple consecutive color codes', () => {
      const oldText = '\x1b[31m\x1b[1mBold Red\x1b[0m';
      const newText = '\x1b[32m\x1b[1mBold Green\x1b[0m';
      
      const segments = findDiffSegments(oldText, newText);
      
      expect(segments.length).toBeGreaterThan(0);
      expect(segments[0].text).toContain('\x1b[32m');
    });

    it('should handle color in middle of unchanged text', () => {
      const oldText = 'Start Middle End';
      const newText = 'Start \x1b[31mMiddle\x1b[0m End';
      
      const segments = findDiffSegments(oldText, newText);
      
      // Should only update the "Middle" part
      expect(segments.length).toBeGreaterThan(0);
      const middleSegment = segments.find(s => s.text.includes('Middle'));
      expect(middleSegment).toBeDefined();
      expect(middleSegment?.text).toContain('\x1b[31m');
    });

    it('should handle removing color from middle of text', () => {
      const oldText = 'Start \x1b[31mMiddle\x1b[0m End';
      const newText = 'Start Middle End';
      
      const segments = findDiffSegments(oldText, newText);
      
      expect(segments.length).toBeGreaterThan(0);
    });

    it('should preserve color state across unchanged characters', () => {
      const oldText = '\x1b[31mRed Text Here\x1b[0m';
      const newText = '\x1b[31mRed Text There\x1b[0m';
      
      const segments = findDiffSegments(oldText, newText);
      
      // Should only update "There" part, but preserve red color
      expect(segments.length).toBeGreaterThan(0);
      const lastSegment = segments[segments.length - 1];
      expect(lastSegment.text).toContain('There');
      // The segment should include the color code to maintain state
      expect(lastSegment.text).toContain('\x1b[31m');
    });

    it('should handle empty string to colored text', () => {
      const oldText = '';
      const newText = '\x1b[31mRed\x1b[0m';
      
      const segments = findDiffSegments(oldText, newText);
      
      expect(segments.length).toBeGreaterThan(0);
      expect(segments[0].start).toBe(0);
      expect(segments[0].text).toContain('\x1b[31m');
    });

    it('should handle colored text to empty string', () => {
      const oldText = '\x1b[31mRed\x1b[0m';
      const newText = '';
      
      const segments = findDiffSegments(oldText, newText);
      
      expect(segments.length).toBeGreaterThan(0);
      expect(segments[0].start).toBe(0);
    });

    it('should handle 256-color codes', () => {
      const oldText = '\x1b[38;5;196mRed 256\x1b[0m';
      const newText = '\x1b[38;5;21mBlue 256\x1b[0m';
      
      const segments = findDiffSegments(oldText, newText);
      
      expect(segments.length).toBeGreaterThan(0);
      expect(segments[0].text).toContain('\x1b[38;5;21m');
    });

    it('should handle RGB color codes', () => {
      const oldText = '\x1b[38;2;255;0;0mRed RGB\x1b[0m';
      const newText = '\x1b[38;2;0;0;255mBlue RGB\x1b[0m';
      
      const segments = findDiffSegments(oldText, newText);
      
      expect(segments.length).toBeGreaterThan(0);
      expect(segments[0].text).toContain('\x1b[38;2;0;0;255m');
    });
  });

  describe('Color State Preservation', () => {
    it('should maintain color state when only text changes', () => {
      const oldText = '\x1b[31mOld\x1b[0m';
      const newText = '\x1b[31mNew\x1b[0m';
      
      const segments = findDiffSegments(oldText, newText);
      
      // Should update the text but maintain the red color
      expect(segments.length).toBeGreaterThan(0);
      expect(segments[0].text).toContain('\x1b[31m');
      expect(segments[0].text).toContain('New');
    });

    it('should handle color state reset in middle of line', () => {
      const oldText = '\x1b[31mRed\x1b[0m Normal';
      const newText = '\x1b[31mRed\x1b[0m Changed';
      
      const segments = findDiffSegments(oldText, newText);
      
      // Should update "Changed" part without color
      expect(segments.length).toBeGreaterThan(0);
    });

    it('should handle multiple color changes in same update', () => {
      const oldText = '\x1b[31mRed\x1b[0m \x1b[32mGreen\x1b[0m';
      const newText = '\x1b[34mBlue\x1b[0m \x1b[33mYellow\x1b[0m';
      
      const segments = findDiffSegments(oldText, newText);
      
      // Should have segments for both color changes
      expect(segments.length).toBeGreaterThan(0);
      const hasBlue = segments.some(s => s.text.includes('\x1b[34m'));
      const hasYellow = segments.some(s => s.text.includes('\x1b[33m'));
      expect(hasBlue).toBe(true);
      expect(hasYellow).toBe(true);
    });
  });
});
