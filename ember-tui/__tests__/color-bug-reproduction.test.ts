import { describe, it, expect } from 'vitest';
import { findDiffSegments } from '../src/render/apply-term-updates';

describe('Color Bug Reproduction Tests', () => {
  describe('Issue: Colors not correctly set in updateLineMinimal', () => {
    it('should preserve color when updating text in middle of colored line', () => {
      // Scenario: Line has colored text, we update part of it
      // Old: "\x1b[31mRed Text Here\x1b[0m"
      // New: "\x1b[31mRed Text There\x1b[0m"
      // Expected: Only "There" should be updated, WITH the red color code
      
      const oldText = '\x1b[31mRed Text Here\x1b[0m';
      const newText = '\x1b[31mRed Text There\x1b[0m';
      
      const segments = findDiffSegments(oldText, newText);
      
      console.log('Segments:', JSON.stringify(segments, null, 2));
      
      // The segment should include the color code to maintain red color
      const hasRedColor = segments.some(s => s.text.includes('\x1b[31m'));
      expect(hasRedColor).toBe(true);
      
      // Should update "There" part
      const hasThereText = segments.some(s => s.text.includes('There'));
      expect(hasThereText).toBe(true);
    });

    it('should handle color reset before new content in updateLineMinimal', () => {
      // The bug might be in updateLineMinimal where it does:
      // buffer.push('\x1b[0m'); // Reset any previous styling
      // This could reset the color we want to apply!
      
      const oldText = '\x1b[31mOld\x1b[0m';
      const newText = '\x1b[32mNew\x1b[0m';
      
      const segments = findDiffSegments(oldText, newText);
      
      console.log('Color change segments:', JSON.stringify(segments, null, 2));
      
      // Should have green color in the segment
      expect(segments[0].text).toContain('\x1b[32m');
      expect(segments[0].text).toContain('New');
    });

    it('should not lose color when segment text includes color code', () => {
      // If segment.text is "\x1b[31mRed", but updateLineMinimal does:
      // buffer.push('\x1b[0m'); // Reset
      // buffer.push(segment.text); // "\x1b[31mRed"
      // The reset might interfere with the color application
      
      const oldText = 'Plain';
      const newText = '\x1b[31mRed\x1b[0m';
      
      const segments = findDiffSegments(oldText, newText);
      
      console.log('Plain to colored segments:', JSON.stringify(segments, null, 2));
      
      // Segment should contain the color code
      expect(segments[0].text).toContain('\x1b[31m');
      expect(segments[0].start).toBe(0);
    });

    it('should handle background color preservation', () => {
      // Background colors are particularly tricky
      const oldText = '\x1b[44mBlue BG Old\x1b[0m';
      const newText = '\x1b[44mBlue BG New\x1b[0m';
      
      const segments = findDiffSegments(oldText, newText);
      
      console.log('Background color segments:', JSON.stringify(segments, null, 2));
      
      // Should preserve background color in the update
      const hasBlueBG = segments.some(s => s.text.includes('\x1b[44m'));
      expect(hasBlueBG).toBe(true);
    });

    it('should handle multiple color codes in segment', () => {
      // When segment has both foreground and background
      const oldText = '\x1b[31m\x1b[44mOld\x1b[0m';
      const newText = '\x1b[31m\x1b[44mNew\x1b[0m';
      
      const segments = findDiffSegments(oldText, newText);
      
      console.log('Multiple color codes segments:', JSON.stringify(segments, null, 2));
      
      // Should have both color codes
      expect(segments[0].text).toContain('\x1b[31m');
      expect(segments[0].text).toContain('\x1b[44m');
    });

    it('should detect issue with reset code placement', () => {
      // The actual bug: updateLineMinimal does buffer.push('\x1b[0m') BEFORE segment.text
      // This means if segment.text is "\x1b[31mRed", the sequence becomes:
      // "\x1b[0m\x1b[31mRed" which is correct
      // BUT if there's a gap or the reset happens at wrong time, colors can be lost
      
      const oldText = '\x1b[31mABC\x1b[0m';
      const newText = '\x1b[31mABD\x1b[0m';
      
      const segments = findDiffSegments(oldText, newText);
      
      console.log('Single char change segments:', JSON.stringify(segments, null, 2));
      
      // Should update only 'D' with red color
      expect(segments.length).toBeGreaterThan(0);
      
      // The segment should include the color state
      const lastSegment = segments[segments.length - 1];
      expect(lastSegment.text).toContain('\x1b[31m');
      expect(lastSegment.text).toContain('D');
    });

    it('should handle color at segment boundary', () => {
      // Edge case: color code right at the boundary of a segment
      const oldText = 'Start \x1b[31mRed\x1b[0m End';
      const newText = 'Start \x1b[32mGreen\x1b[0m End';
      
      const segments = findDiffSegments(oldText, newText);
      
      console.log('Boundary color segments:', JSON.stringify(segments, null, 2));
      
      // Should detect the color change
      const hasGreen = segments.some(s => s.text.includes('\x1b[32m'));
      expect(hasGreen).toBe(true);
    });

    it('should handle color bleeding between segments', () => {
      // If first segment ends with color, second segment should not inherit it
      // unless explicitly included
      const oldText = '\x1b[31mRed\x1b[0m Normal';
      const newText = '\x1b[31mRed\x1b[0m Changed';
      
      const segments = findDiffSegments(oldText, newText);
      
      console.log('Color bleeding segments:', JSON.stringify(segments, null, 2));
      
      // "Changed" should not have red color
      const changedSegment = segments.find(s => s.text.includes('Changed'));
      if (changedSegment) {
        // Should NOT have red color code (unless it's a reset)
        const hasRedColor = changedSegment.text.includes('\x1b[31m') && 
                           !changedSegment.text.startsWith('\x1b[0m');
        expect(hasRedColor).toBe(false);
      }
    });

    it('should handle empty segment with color state', () => {
      // Edge case: segment is empty but has color state
      const oldText = '\x1b[31mRed\x1b[0m';
      const newText = '\x1b[31m\x1b[0m';
      
      const segments = findDiffSegments(oldText, newText);
      
      console.log('Empty with color segments:', JSON.stringify(segments, null, 2));
      
      // Should handle empty text with color codes
      expect(segments.length).toBeGreaterThan(0);
    });

    it('should preserve color across whitespace changes', () => {
      // Whitespace changes should preserve color
      const oldText = '\x1b[31mRed  Text\x1b[0m';
      const newText = '\x1b[31mRed Text\x1b[0m';
      
      const segments = findDiffSegments(oldText, newText);
      
      console.log('Whitespace change segments:', JSON.stringify(segments, null, 2));
      
      // Should preserve red color
      const hasRedColor = segments.some(s => s.text.includes('\x1b[31m'));
      expect(hasRedColor).toBe(true);
    });
  });

  describe('Potential Bug: Reset code timing', () => {
    it('should not reset color before applying new color in same segment', () => {
      // This tests the specific issue in updateLineMinimal:
      // It does: buffer.push('\x1b[0m'); buffer.push(segment.text);
      // If segment.text already starts with a color code, this is fine
      // But if segment.text is just text and relies on ansiState, it's wrong
      
      const oldText = 'Plain';
      const newText = '\x1b[31mColored\x1b[0m';
      
      const segments = findDiffSegments(oldText, newText);
      
      console.log('Reset timing segments:', JSON.stringify(segments, null, 2));
      
      // The segment text should include the color code
      expect(segments[0].text).toContain('\x1b[31m');
      
      // Verify the segment structure
      expect(segments[0].start).toBe(0);
      expect(segments[0].text).toContain('Colored');
    });

    it('should handle case where ansiState is in segment but not in text', () => {
      // This might be the bug: if segment has ansiState but segment.text
      // doesn't include it, the color is lost after reset
      
      const oldText = '\x1b[31mRed ABC\x1b[0m';
      const newText = '\x1b[31mRed XYZ\x1b[0m';
      
      const segments = findDiffSegments(oldText, newText);
      
      console.log('AnsiState in segment:', JSON.stringify(segments, null, 2));
      
      // The segment updating XYZ should include the red color
      const xyzSegment = segments.find(s => s.text.includes('XYZ'));
      if (xyzSegment) {
        expect(xyzSegment.text).toContain('\x1b[31m');
      }
    });
  });
});
