import { describe, it, expect } from 'vitest';
import { findDiffSegments } from '../src/render/apply-term-updates';

describe('Specific Gray Bug - Detailed Analysis', () => {
  it('should show exact segment content for middle character with spaces', () => {
    // This is the exact scenario: character in middle surrounded by spaces
    const oldText = 'A B C';
    const newText = 'A \x1b[31mB\x1b[0m C';
    
    const segments = findDiffSegments(oldText, newText);
    
    console.log('\n=== DETAILED SEGMENT ANALYSIS ===');
    console.log('Old text:', JSON.stringify(oldText));
    console.log('New text:', JSON.stringify(newText));
    console.log('Number of segments:', segments.length);
    
    segments.forEach((seg, i) => {
      console.log(`\nSegment ${i}:`);
      console.log('  start:', seg.start);
      console.log('  text:', JSON.stringify(seg.text));
      console.log('  text length:', seg.text.length);
      console.log('  has \\x1b[31m:', seg.text.includes('\x1b[31m'));
      console.log('  has \\x1b[0m:', seg.text.includes('\x1b[0m'));
      console.log('  visible chars:', seg.text.replace(/\x1b\[[0-9;]*m/g, ''));
    });
    
    // The segment should include the color code
    const bSegment = segments.find(s => s.text.includes('B'));
    expect(bSegment).toBeDefined();
    expect(bSegment?.text).toContain('\x1b[31m');
  });

  it('should check if reset in new text causes segment to not include color', () => {
    // Maybe the issue is that the reset in the new text causes problems
    const oldText = 'ABC';
    const newText = 'A\x1b[31mB\x1b[0mC';
    
    const segments = findDiffSegments(oldText, newText);
    
    console.log('\n=== RESET IN NEW TEXT ===');
    segments.forEach((seg, i) => {
      console.log(`Segment ${i}:`, JSON.stringify(seg));
    });
    
    // Check if B segment includes both color and reset
    const bSegment = segments.find(s => s.text.includes('B'));
    console.log('\nB segment:', JSON.stringify(bSegment));
    console.log('Has color code:', bSegment?.text.includes('\x1b[31m'));
    console.log('Has reset code:', bSegment?.text.includes('\x1b[0m'));
  });

  it('should check segment building with only middle char different', () => {
    // Plain text, only middle char changes
    const oldText = 'ABC';
    const newText = 'AXC';
    
    const segments = findDiffSegments(oldText, newText);
    
    console.log('\n=== PLAIN TEXT MIDDLE CHANGE ===');
    segments.forEach((seg, i) => {
      console.log(`Segment ${i}:`, JSON.stringify(seg));
    });
  });

  it('should check if color state is preserved when only middle char has color', () => {
    // All same chars, but middle one gets color
    const oldText = 'BBB';
    const newText = 'B\x1b[31mB\x1b[0mB';
    
    const segments = findDiffSegments(oldText, newText);
    
    console.log('\n=== SAME CHARS, MIDDLE COLORED ===');
    segments.forEach((seg, i) => {
      console.log(`Segment ${i}:`, JSON.stringify(seg));
    });
    
    // Should have a segment for the middle B with color
    expect(segments.length).toBeGreaterThan(0);
  });

  it('should identify if the problem is with how ANSI state is tracked', () => {
    // Test various scenarios
    const scenarios = [
      { old: 'A B C', new: 'A \x1b[31mB\x1b[0m C', desc: 'Middle B red with spaces' },
      { old: 'ABC', new: 'A\x1b[31mB\x1b[0mC', desc: 'Middle B red no spaces' },
      { old: 'A B C', new: '\x1b[31mA\x1b[0m B C', desc: 'First A red' },
      { old: 'A B C', new: 'A B \x1b[31mC\x1b[0m', desc: 'Last C red' },
    ];
    
    console.log('\n=== MULTIPLE SCENARIOS ===');
    scenarios.forEach(({ old, new: newText, desc }) => {
      const segments = findDiffSegments(old, newText);
      console.log(`\n${desc}:`);
      console.log('  Segments:', segments.length);
      segments.forEach((seg, i) => {
        console.log(`  Segment ${i}: start=${seg.start}, text=${JSON.stringify(seg.text)}`);
      });
    });
  });
});
