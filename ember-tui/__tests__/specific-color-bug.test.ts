import { describe, it, expect } from 'vitest';
import { findDiffSegments } from '../src/render/apply-term-updates';

describe('Specific Color Bug Investigation', () => {
  it('should show the exact segment structure for background color update', () => {
    const oldText = '\x1b[44mBlue Background Old Text\x1b[0m';
    const newText = '\x1b[44mBlue Background New Text\x1b[0m';
    
    const segments = findDiffSegments(oldText, newText);
    
    console.log('Segments for background color update:');
    segments.forEach((seg, i) => {
      console.log(`  Segment ${i}:`);
      console.log(`    start: ${seg.start}`);
      console.log(`    text: ${JSON.stringify(seg.text)}`);
      console.log(`    text includes \\x1b[44m: ${seg.text.includes('\x1b[44m')}`);
    });
    
    // The segment should include the background color
    const hasBackgroundColor = segments.some(s => s.text.includes('\x1b[44m'));
    expect(hasBackgroundColor).toBe(true);
  });

  it('should show segment structure when color changes mid-line', () => {
    const oldText = 'Start \x1b[31mRed\x1b[0m End';
    const newText = 'Start \x1b[32mGreen\x1b[0m End';
    
    const segments = findDiffSegments(oldText, newText);
    
    console.log('\nSegments for mid-line color change:');
    segments.forEach((seg, i) => {
      console.log(`  Segment ${i}:`);
      console.log(`    start: ${seg.start}`);
      console.log(`    text: ${JSON.stringify(seg.text)}`);
    });
    
    // Should have green color in one of the segments
    const hasGreen = segments.some(s => s.text.includes('\x1b[32m'));
    expect(hasGreen).toBe(true);
  });

  it('should show what happens when only part of colored text changes', () => {
    const oldText = '\x1b[31mRed ABC DEF\x1b[0m';
    const newText = '\x1b[31mRed ABC XYZ\x1b[0m';
    
    const segments = findDiffSegments(oldText, newText);
    
    console.log('\nSegments for partial colored text change:');
    segments.forEach((seg, i) => {
      console.log(`  Segment ${i}:`);
      console.log(`    start: ${seg.start}`);
      console.log(`    text: ${JSON.stringify(seg.text)}`);
      console.log(`    text includes \\x1b[31m: ${seg.text.includes('\x1b[31m')}`);
    });
    
    // The segment with XYZ should include red color
    const xyzSegment = segments.find(s => s.text.includes('XYZ'));
    expect(xyzSegment).toBeDefined();
    expect(xyzSegment?.text).toContain('\x1b[31m');
  });

  it('should show what happens with background color in middle of line', () => {
    const oldText = 'Plain \x1b[44mBlue BG Old\x1b[0m More';
    const newText = 'Plain \x1b[44mBlue BG New\x1b[0m More';
    
    const segments = findDiffSegments(oldText, newText);
    
    console.log('\nSegments for background in middle:');
    segments.forEach((seg, i) => {
      console.log(`  Segment ${i}:`);
      console.log(`    start: ${seg.start}`);
      console.log(`    text: ${JSON.stringify(seg.text)}`);
      console.log(`    text includes \\x1b[44m: ${seg.text.includes('\x1b[44m')}`);
    });
    
    // Should have background color in the segment
    const hasBackgroundColor = segments.some(s => s.text.includes('\x1b[44m'));
    expect(hasBackgroundColor).toBe(true);
  });

  it('should identify if color is lost when segment does not start at 0', () => {
    // This is the suspected bug: when a segment starts at position > 0,
    // and the text before it has a color, does the segment preserve that color?
    
    const oldText = '\x1b[31mRed Text Here\x1b[0m';
    const newText = '\x1b[31mRed Text There\x1b[0m';
    
    const segments = findDiffSegments(oldText, newText);
    
    console.log('\nSegments for text change in colored line:');
    segments.forEach((seg, i) => {
      console.log(`  Segment ${i}:`);
      console.log(`    start: ${seg.start}`);
      console.log(`    text: ${JSON.stringify(seg.text)}`);
      console.log(`    visual position: ${seg.start}`);
      console.log(`    text includes \\x1b[31m: ${seg.text.includes('\x1b[31m')}`);
    });
    
    // The segment should start at position 9 (after "Red Text ")
    // and should include the red color code
    const thereSegment = segments.find(s => s.text.includes('There'));
    expect(thereSegment).toBeDefined();
    expect(thereSegment?.start).toBe(9);
    
    // THIS IS THE KEY TEST: Does the segment include the color code?
    expect(thereSegment?.text).toContain('\x1b[31m');
    
    // If this passes, the bug is NOT in findDiffSegments
    // If this fails, the bug IS in findDiffSegments
  });

  it('should check if reset code interferes with color application', () => {
    // Simulate what updateLineMinimal does:
    // 1. Move cursor to segment.start
    // 2. Write '\x1b[0m' (reset)
    // 3. Write segment.text
    
    const oldText = '\x1b[31mRed Text Here\x1b[0m';
    const newText = '\x1b[31mRed Text There\x1b[0m';
    
    const segments = findDiffSegments(oldText, newText);
    
    console.log('\nSimulating updateLineMinimal behavior:');
    segments.forEach((seg, i) => {
      console.log(`  Segment ${i}:`);
      console.log(`    1. Move cursor to position ${seg.start}`);
      console.log(`    2. Write reset: \\x1b[0m`);
      console.log(`    3. Write segment.text: ${JSON.stringify(seg.text)}`);
      
      // Simulate the actual sequence
      const sequence = `\x1b[0m${seg.text}`;
      console.log(`    Actual sequence: ${JSON.stringify(sequence)}`);
      
      // Check if color is in the sequence
      const hasColor = sequence.includes('\x1b[31m');
      console.log(`    Has red color in sequence: ${hasColor}`);
    });
  });
});
