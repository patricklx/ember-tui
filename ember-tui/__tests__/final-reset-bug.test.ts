import { describe, it, expect } from 'vitest';
import { findDiffSegments } from '../src/render/apply-term-updates';

describe('Final Reset Code Bug', () => {
  it('should identify the double reset bug in updateLineMinimal', () => {
    // The bug: updateLineMinimal adds a reset code at the END of the function
    // This happens AFTER writing segment.text, which can prematurely reset colors
    
    const oldText = '\x1b[44mBlue Background Old Text\x1b[0m';
    const newText = '\x1b[44mBlue Background New Text\x1b[0m';
    
    const segments = findDiffSegments(oldText, newText);
    
    console.log('\nAnalyzing the double reset bug:');
    console.log('Segment:', JSON.stringify(segments[0]));
    
    // Simulate what updateLineMinimal does:
    const buffer: string[] = [];
    
    // 1. Move cursor
    buffer.push(`\x1b[1;${segments[0].start + 1}H`);
    
    // 2. Reset before segment
    buffer.push('\x1b[0m');
    
    // 3. Write segment text (includes color)
    buffer.push(segments[0].text);
    
    // 4. THE BUG: Reset at end of function (line 674)
    buffer.push('\x1b[0m');
    
    const sequence = buffer.join('');
    console.log('Actual sequence:', JSON.stringify(sequence));
    
    // Count reset codes
    const resetCount = (sequence.match(/\x1b\[0m/g) || []).length;
    console.log('Number of reset codes:', resetCount);
    
    // The bug: there are TWO reset codes
    // One before segment.text (correct)
    // One after segment.text (BUG - resets the background color prematurely)
    expect(resetCount).toBe(2); // This demonstrates the bug
    
    // The problem: the second reset comes BEFORE the rest of the line
    // So if segment.text is "\x1b[44mNew", the sequence is:
    // reset + "\x1b[44mNew" + reset
    // This means "New" has blue background, but then it's immediately reset
    // before the rest of the line (" Text") is rendered
    
    // The fix should be: only add the final reset AFTER all segments are processed
    // and AFTER any trailing space filling
  });

  it('should show how the bug affects background colors', () => {
    // When updating middle of a line with background color:
    // Old: "\x1b[44mBlue Background Old Text\x1b[0m"
    // New: "\x1b[44mBlue Background New Text\x1b[0m"
    
    // Segment is: {start: 16, text: "\x1b[44mNew"}
    
    // updateLineMinimal produces:
    // 1. Move to column 17 (position 16 + 1)
    // 2. Reset: \x1b[0m
    // 3. Write: \x1b[44mNew
    // 4. Reset: \x1b[0m  <-- BUG! This resets the background
    
    // The terminal sees:
    // - Move to column 17
    // - Reset all formatting
    // - Apply blue background
    // - Write "New"
    // - Reset all formatting  <-- This removes the blue background!
    
    // But the rest of the line " Text" is still there from the old render
    // So " Text" appears WITHOUT blue background, even though it should have it
    
    // The fix: move the final reset to AFTER the segment loop
    // and AFTER the needsClearRight logic
    
    expect(true).toBe(true); // This test documents the bug
  });

  it('should show the correct sequence without the bug', () => {
    const oldText = '\x1b[44mBlue Background Old Text\x1b[0m';
    const newText = '\x1b[44mBlue Background New Text\x1b[0m';
    
    const segments = findDiffSegments(oldText, newText);
    
    console.log('\nCorrect sequence (without bug):');
    
    const buffer: string[] = [];
    
    // 1. Move cursor
    buffer.push(`\x1b[1;${segments[0].start + 1}H`);
    
    // 2. Reset before segment
    buffer.push('\x1b[0m');
    
    // 3. Write segment text (includes color)
    buffer.push(segments[0].text);
    
    // 4. NO RESET HERE - let the color continue
    
    // 5. Only reset at the VERY END, after all segments
    // (This should be OUTSIDE the segment loop)
    
    const sequenceWithoutBug = buffer.join('');
    console.log('Sequence without bug:', JSON.stringify(sequenceWithoutBug));
    
    // Then add final reset AFTER all segments
    buffer.push('\x1b[0m');
    
    const finalSequence = buffer.join('');
    console.log('Final sequence with reset at end:', JSON.stringify(finalSequence));
    
    // This way, the background color persists through the entire update
    // and is only reset at the very end
  });
});
