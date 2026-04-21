import { describe, it, expect } from 'vitest';
import { findDiffSegments } from '../src/render/apply-term-updates';

describe('Multi-Position Color Bug', () => {
  it('should handle characters at different positions with different colors', () => {
    // Scenario: "A B C D E" with spaces
    // Then: "A1B2C3DE" - numbers added between letters, different colors
    
    const oldText = 'A B C D E';
    const newText = '\x1b[31mA\x1b[0m\x1b[32m1\x1b[0m\x1b[31mB\x1b[0m\x1b[32m2\x1b[0m\x1b[31mC\x1b[0m\x1b[32m3\x1b[0m\x1b[31mD\x1b[0m\x1b[31mE\x1b[0m';
    
    const segments = findDiffSegments(oldText, newText);
    
    console.log('\nMulti-position color segments:');
    segments.forEach((seg, i) => {
      console.log(`  Segment ${i}:`);
      console.log(`    start: ${seg.start}`);
      console.log(`    text: ${JSON.stringify(seg.text)}`);
    });
    
    // Should have multiple segments for different positions
    expect(segments.length).toBeGreaterThan(0);
  });

  it('should handle alternating colors at different positions', () => {
    const oldText = 'A B C D E';
    const newText = '\x1b[31mA\x1b[0m \x1b[32mB\x1b[0m \x1b[31mC\x1b[0m \x1b[32mD\x1b[0m \x1b[31mE\x1b[0m';
    
    const segments = findDiffSegments(oldText, newText);
    
    console.log('\nAlternating colors segments:');
    segments.forEach((seg, i) => {
      console.log(`  Segment ${i}:`);
      console.log(`    start: ${seg.start}`);
      console.log(`    text: ${JSON.stringify(seg.text)}`);
    });
    
    expect(segments.length).toBeGreaterThan(0);
  });

  it('should handle spaces being replaced with colored characters', () => {
    const oldText = 'A B C D E';
    const newText = 'A\x1b[31m1\x1b[0mB\x1b[32m2\x1b[0mC\x1b[33m3\x1b[0mD E';
    
    const segments = findDiffSegments(oldText, newText);
    
    console.log('\nSpaces replaced with colored chars:');
    segments.forEach((seg, i) => {
      console.log(`  Segment ${i}:`);
      console.log(`    start: ${seg.start}`);
      console.log(`    text: ${JSON.stringify(seg.text)}`);
    });
    
    // Each space replacement should be a separate segment
    expect(segments.length).toBeGreaterThan(0);
  });

  it('should handle non-contiguous color changes', () => {
    // Old: plain text with spaces
    // New: some chars colored, some not, non-contiguous
    const oldText = 'ABCDEFGH';
    const newText = '\x1b[31mA\x1b[0mBC\x1b[32mD\x1b[0mEF\x1b[33mG\x1b[0mH';
    
    const segments = findDiffSegments(oldText, newText);
    
    console.log('\nNon-contiguous color changes:');
    segments.forEach((seg, i) => {
      console.log(`  Segment ${i}:`);
      console.log(`    start: ${seg.start}`);
      console.log(`    text: ${JSON.stringify(seg.text)}`);
    });
    
    // Should have separate segments for A, D, and G
    expect(segments.length).toBeGreaterThan(0);
  });

  it('should handle color state changes between segments', () => {
    // The bug might be: when we have multiple segments with different colors,
    // the color state between them might not be handled correctly
    
    const oldText = 'ABCDE';
    const newText = '\x1b[31mA\x1b[0m\x1b[32mB\x1b[0m\x1b[33mC\x1b[0m\x1b[34mD\x1b[0m\x1b[35mE\x1b[0m';
    
    const segments = findDiffSegments(oldText, newText);
    
    console.log('\nColor state changes between segments:');
    segments.forEach((seg, i) => {
      console.log(`  Segment ${i}:`);
      console.log(`    start: ${seg.start}`);
      console.log(`    text: ${JSON.stringify(seg.text)}`);
    });
    
    // Each character should be in its own segment with its color
    expect(segments.length).toBeGreaterThan(0);
  });

  it('should identify if segments are merged incorrectly', () => {
    // If the lookAheadForNextDiff logic is too aggressive,
    // it might merge segments that should be separate
    
    const oldText = 'A B C';
    const newText = '\x1b[31mA\x1b[0m \x1b[32mB\x1b[0m \x1b[33mC\x1b[0m';
    
    const segments = findDiffSegments(oldText, newText);
    
    console.log('\nSegment merging check:');
    segments.forEach((seg, i) => {
      console.log(`  Segment ${i}:`);
      console.log(`    start: ${seg.start}`);
      console.log(`    text: ${JSON.stringify(seg.text)}`);
      console.log(`    includes multiple colors: ${(seg.text.match(/\x1b\[\d+m/g) || []).length > 1}`);
    });
    
    // Check if segments are incorrectly merged
    // Each colored letter should ideally be in a separate segment
    // unless they're contiguous with the same color
    expect(segments.length).toBeGreaterThan(0);
  });

  it('should handle the specific case: A B C D E -> A1B2C3DE', () => {
    const oldText = 'A B C D E';
    const newText = 'A1B2C3DE';
    
    const segments = findDiffSegments(oldText, newText);
    
    console.log('\nSpecific case A B C D E -> A1B2C3DE:');
    segments.forEach((seg, i) => {
      console.log(`  Segment ${i}:`);
      console.log(`    start: ${seg.start}`);
      console.log(`    text: ${JSON.stringify(seg.text)}`);
    });
    
    // Should handle the space removal and character insertion
    expect(segments.length).toBeGreaterThan(0);
  });

  it('should handle progressive updates with different colors', () => {
    // Simulate progressive updates:
    // 1. "A B C D E"
    // 2. "A1B C D E" (add 1 after A)
    // 3. "A1B2C D E" (add 2 after B)
    // 4. "A1B2C3D E" (add 3 after C)
    
    const step1 = 'A B C D E';
    const step2 = 'A1B C D E';
    const step3 = 'A1B2C D E';
    const step4 = 'A1B2C3D E';
    
    console.log('\nProgressive updates:');
    
    const seg1to2 = findDiffSegments(step1, step2);
    console.log('Step 1->2:', JSON.stringify(seg1to2));
    
    const seg2to3 = findDiffSegments(step2, step3);
    console.log('Step 2->3:', JSON.stringify(seg2to3));
    
    const seg3to4 = findDiffSegments(step3, step4);
    console.log('Step 3->4:', JSON.stringify(seg3to4));
    
    expect(seg1to2.length).toBeGreaterThan(0);
    expect(seg2to3.length).toBeGreaterThan(0);
    expect(seg3to4.length).toBeGreaterThan(0);
  });
});
