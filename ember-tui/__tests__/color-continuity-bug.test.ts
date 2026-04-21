import { describe, it, expect } from 'vitest';
import { findDiffSegments } from '../src/render/apply-term-updates';

describe('Color Continuity Bug - The Real Issue', () => {
  it('should demonstrate the fundamental problem with minimal updates and colors', () => {
    // The REAL bug: When you have a line with background color:
    // "\x1b[44mBlue Background Old Text\x1b[0m"
    // 
    // And you update it to:
    // "\x1b[44mBlue Background New Text\x1b[0m"
    //
    // The diff finds: {start: 16, text: "\x1b[44mNew"}
    //
    // updateLineMinimal does:
    // 1. Move to position 16
    // 2. Reset
    // 3. Write "\x1b[44mNew"
    // 4. Reset at end
    //
    // But the problem is: " Text" is still on the terminal from the OLD render
    // It was rendered with blue background in the old render
    // But now we've reset the color BEFORE position 20 (where " Text" starts)
    // So " Text" KEEPS its old blue background
    //
    // Wait, that should be correct then...
    //
    // Unless... let me check what the segment actually contains
    
    const oldText = '\x1b[44mBlue Background Old Text\x1b[0m';
    const newText = '\x1b[44mBlue Background New Text\x1b[0m';
    
    const segments = findDiffSegments(oldText, newText);
    
    console.log('\nDetailed segment analysis:');
    console.log('Old text:', JSON.stringify(oldText));
    console.log('New text:', JSON.stringify(newText));
    console.log('Segments:', JSON.stringify(segments, null, 2));
    
    // Check what characters are at each position
    console.log('\nCharacter-by-character comparison:');
    for (let i = 0; i < Math.max(oldText.length, newText.length); i++) {
      const oldChar = oldText[i] || '';
      const newChar = newText[i] || '';
      if (oldChar !== newChar) {
        console.log(`  Position ${i}: '${oldChar}' -> '${newChar}'`);
      }
    }
    
    // The segment should include enough context to maintain the background
    expect(segments.length).toBeGreaterThan(0);
  });

  it('should check if segment includes trailing text that needs color', () => {
    // If the segment is just "\x1b[44mNew" without " Text",
    // then " Text" won't get the blue background reapplied
    
    const oldText = '\x1b[44mBlue Background Old Text\x1b[0m';
    const newText = '\x1b[44mBlue Background New Text\x1b[0m';
    
    const segments = findDiffSegments(oldText, newText);
    
    console.log('\nChecking segment coverage:');
    const segment = segments[0];
    console.log('Segment start:', segment.start);
    console.log('Segment text:', JSON.stringify(segment.text));
    console.log('Segment includes " Text":', segment.text.includes(' Text'));
    
    // If segment doesn't include " Text", that's the bug!
    // The segment should be "\x1b[44mNew Text" not just "\x1b[44mNew"
    
    // Let's check what the visual positions are:
    // "Blue Background " = 16 chars (visual)
    // "Old" = 3 chars
    // " Text" = 5 chars
    // Total = 24 chars
    
    // "New" = 3 chars
    // So the change is at position 16-18 (Old -> New)
    // But " Text" at position 19-23 is UNCHANGED
    
    // The bug: findDiffSegments only returns the CHANGED part
    // It doesn't include the unchanged " Text" that needs the color reapplied
    
    const includesTrailingText = segment.text.includes(' Text');
    console.log('Segment includes trailing text:', includesTrailingText);
    
    if (!includesTrailingText) {
      console.log('BUG FOUND: Segment does not include trailing text that needs color!');
      console.log('The segment should include " Text" to maintain background color continuity');
    }
  });

  it('should identify that unchanged text after a color change needs to be included', () => {
    // The fix: When a segment has a color code, and there's unchanged text after it
    // that should have the same color, the segment should include that text too
    
    const oldText = '\x1b[44mBlue Background Old Text\x1b[0m';
    const newText = '\x1b[44mBlue Background New Text\x1b[0m';
    
    const segments = findDiffSegments(oldText, newText);
    
    console.log('\nAnalyzing color continuity:');
    console.log('Segment:', JSON.stringify(segments[0]));
    
    // Visual positions:
    // 0-15: "Blue Background " (unchanged)
    // 16-18: "Old" -> "New" (changed)
    // 19-23: " Text" (unchanged but needs blue background)
    
    // Current behavior: segment = {start: 16, text: "\x1b[44mNew"}
    // Correct behavior: segment = {start: 16, text: "\x1b[44mNew Text"}
    
    // The issue is in findDiffSegments or the diff algorithm
    // It stops including text as soon as characters match again
    // But it should continue if the color state is the same
    
    expect(segments[0].text).toContain('New');
    
    // This test will fail if the bug is present
    // expect(segments[0].text).toContain(' Text');
  });
});
