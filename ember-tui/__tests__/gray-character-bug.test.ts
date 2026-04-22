import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render } from '../src/render/apply-term-updates';
import ElementNode from '../src/dom/nodes/ElementNode';
import { extractLines } from '../src/render/collect-lines';
import { FakeTTY } from '../src/test-utils/FakeTTY';
import { findDiffSegments } from '../src/render/apply-term-updates';

vi.mock('../src/render/collect-lines', () => ({
  extractLines: vi.fn()
}));

describe('Gray Character Bug - Character in middle loses color', () => {
  let fakeTTY: FakeTTY;
  let originalProcess: typeof process;
  const mockExtractLines = extractLines as any;

  beforeEach(() => {
    fakeTTY = new FakeTTY();
    originalProcess = global.process;
    (global as any).process = {
      ...originalProcess,
      stdout: fakeTTY as any,
      stderr: originalProcess.stderr,
      stdin: originalProcess.stdin,
    };
    mockExtractLines.mockReset();
  });

  afterEach(() => {
    (global as any).process = originalProcess;
  });

  it('should keep color on middle character surrounded by spaces', () => {
    const root = new ElementNode('div');

    // First render - plain text
    mockExtractLines.mockReturnValue({
      static: [],
      dynamic: ['A B C']
    });
    render(root, global.process);
    fakeTTY.clear();

    // Second render - middle character (B) should be red
    mockExtractLines.mockReturnValue({
      static: [],
      dynamic: ['A \x1b[31mB\x1b[0m C']
    });
    render(root, global.process);

    const updateOutput = fakeTTY.getFullOutput();
    const updateRaw = fakeTTY.getOutputSinceClear();
    console.log('Middle char output:', updateOutput);
    console.log('Middle char RAW:', JSON.stringify(updateRaw));
    
    // Check that B is present and has red color
    expect(updateOutput).toContain('B');
    expect(updateRaw).toContain('\x1b[31m'); // Red color code
    
    // The issue: B might appear gray because the reset before the segment
    // clears the color, and then we only write 'B' without the color code
  });

  it('should analyze segments for middle character color', () => {
    const oldText = 'A B C';
    const newText = 'A \x1b[31mB\x1b[0m C';
    
    const segments = findDiffSegments(oldText, newText);
    
    console.log('\nMiddle character segments:');
    segments.forEach((seg, i) => {
      console.log(`  Segment ${i}:`);
      console.log(`    start: ${seg.start}`);
      console.log(`    text: ${JSON.stringify(seg.text)}`);
      console.log(`    has color code: ${seg.text.includes('\x1b[')}`);
    });
    
    // The segment should include the color codes
    const middleSegment = segments.find(s => s.text.includes('B'));
    expect(middleSegment).toBeDefined();
    expect(middleSegment?.text).toContain('\x1b[31m');
  });

  it('should handle multiple middle characters with different colors', () => {
    const root = new ElementNode('div');

    mockExtractLines.mockReturnValue({
      static: [],
      dynamic: ['A B C D E']
    });
    render(root, global.process);
    fakeTTY.clear();

    // Color B and D
    mockExtractLines.mockReturnValue({
      static: [],
      dynamic: ['A \x1b[31mB\x1b[0m C \x1b[32mD\x1b[0m E']
    });
    render(root, global.process);

    const updateRaw = fakeTTY.getOutputSinceClear();
    console.log('Multiple middle chars RAW:', JSON.stringify(updateRaw));
    
    expect(updateRaw).toContain('\x1b[31m'); // Red for B
    expect(updateRaw).toContain('\x1b[32m'); // Green for D
  });

  it('should handle case where only middle character changes', () => {
    const oldText = 'A B C';
    const newText = 'A X C';
    
    const segments = findDiffSegments(oldText, newText);
    
    console.log('\nMiddle character change segments:');
    segments.forEach((seg, i) => {
      console.log(`  Segment ${i}:`);
      console.log(`    start: ${seg.start}`);
      console.log(`    text: ${JSON.stringify(seg.text)}`);
    });
    
    // Should have a segment for the middle character
    expect(segments.length).toBeGreaterThan(0);
  });

  it('should handle middle character with color when surrounded by unchanged text', () => {
    const oldText = 'ABCDE';
    const newText = 'AB\x1b[31mC\x1b[0mDE';
    
    const segments = findDiffSegments(oldText, newText);
    
    console.log('\nMiddle char with color segments:');
    segments.forEach((seg, i) => {
      console.log(`  Segment ${i}:`);
      console.log(`    start: ${seg.start}`);
      console.log(`    text: ${JSON.stringify(seg.text)}`);
    });
    
    // The segment should include C with its color codes
    const colorSegment = segments.find(s => s.text.includes('C'));
    expect(colorSegment).toBeDefined();
    expect(colorSegment?.text).toContain('\x1b[31m');
  });

  it('should identify if reset is clearing color before writing colored character', () => {
    const root = new ElementNode('div');

    mockExtractLines.mockReturnValue({
      static: [],
      dynamic: ['ABC']
    });
    render(root, global.process);
    fakeTTY.clear();

    // Middle character should be red
    mockExtractLines.mockReturnValue({
      static: [],
      dynamic: ['A\x1b[31mB\x1b[0mC']
    });
    render(root, global.process);

    const updateRaw = fakeTTY.getOutputSinceClear();
    console.log('Reset before colored char RAW:', JSON.stringify(updateRaw));
    
    // Check the sequence: should be reset, then color, then B
    // If we see: reset, B (without color), that's the bug
    const hasResetBeforeColor = updateRaw.includes('\x1b[0m\x1b[31m');
    const hasResetWithoutColor = updateRaw.match(/\x1b\[0m[^B]*B/) && !updateRaw.includes('\x1b[31mB');
    
    console.log('Has reset before color:', hasResetBeforeColor);
    console.log('Has reset without color:', hasResetWithoutColor);
    
    expect(updateRaw).toContain('\x1b[31mB');
  });
});
