import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render } from '../src/render/apply-term-updates';
import ElementNode from '../src/dom/nodes/ElementNode';
import { extractLines } from '../src/render/collect-lines';
import { FakeTTY } from '../src/test-utils/FakeTTY';
import { findDiffSegments } from '../src/render/apply-term-updates';

vi.mock('../src/render/collect-lines', () => ({
  extractLines: vi.fn()
}));

describe('Animated Color Bug - Progressive Character Reveal', () => {
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

  it('should handle progressive character reveal with color (animation scenario)', () => {
    const root = new ElementNode('div');

    // Frame 1: All spaces (not revealed yet)
    mockExtractLines.mockReturnValue({
      static: [],
      dynamic: ['\x1b[38;2;120;169;255m    \x1b[0m']
    });
    render(root, global.process);
    fakeTTY.clear();

    // Frame 2: Some characters revealed (B and O visible, B and space still hidden)
    mockExtractLines.mockReturnValue({
      static: [],
      dynamic: ['\x1b[38;2;120;169;255mBO  \x1b[0m']
    });
    render(root, global.process);

    const output = fakeTTY.getFullOutput();
    const rawOutput = fakeTTY.getOutputSinceClear();
    
    console.log('\n=== ANIMATION FRAME 2 ===');
    console.log('Visual output:', output);
    console.log('Raw output:', JSON.stringify(rawOutput));
    
    // The characters should have the color
    expect(rawOutput).toContain('\x1b[38;2;120;169;255m');
    expect(output).toContain('BO');
  });

  it('should analyze segments for progressive reveal', () => {
    const oldText = '\x1b[38;2;120;169;255m    \x1b[0m';
    const newText = '\x1b[38;2;120;169;255mBO  \x1b[0m';
    
    const segments = findDiffSegments(oldText, newText);
    
    console.log('\n=== PROGRESSIVE REVEAL SEGMENTS ===');
    console.log('Old:', JSON.stringify(oldText));
    console.log('New:', JSON.stringify(newText));
    console.log('Segments:', segments.length);
    segments.forEach((seg, i) => {
      console.log(`  Segment ${i}:`);
      console.log(`    start: ${seg.start}`);
      console.log(`    text: ${JSON.stringify(seg.text)}`);
      console.log(`    has color: ${seg.text.includes('\x1b[38;2')}`);
    });
    
    // Should have segments that include the color codes
    expect(segments.length).toBeGreaterThan(0);
  });

  it('should handle multiple progressive reveals on same line', () => {
    const root = new ElementNode('div');

    // Frame 1
    mockExtractLines.mockReturnValue({
      static: [],
      dynamic: ['\x1b[38;2;120;169;255m    \x1b[0m']
    });
    render(root, global.process);
    fakeTTY.clear();

    // Frame 2
    mockExtractLines.mockReturnValue({
      static: [],
      dynamic: ['\x1b[38;2;120;169;255mB   \x1b[0m']
    });
    render(root, global.process);
    fakeTTY.clear();

    // Frame 3
    mockExtractLines.mockReturnValue({
      static: [],
      dynamic: ['\x1b[38;2;120;169;255mBO  \x1b[0m']
    });
    render(root, global.process);
    fakeTTY.clear();

    // Frame 4
    mockExtractLines.mockReturnValue({
      static: [],
      dynamic: ['\x1b[38;2;120;169;255mBOB \x1b[0m']
    });
    render(root, global.process);

    const rawOutput = fakeTTY.getOutputSinceClear();
    console.log('\n=== FRAME 4 RAW ===');
    console.log(JSON.stringify(rawOutput));
    
    expect(rawOutput).toContain('\x1b[38;2;120;169;255m');
  });

  it('should handle case where color wraps entire line including spaces', () => {
    // This is the actual pattern from the header component
    const oldText = '\x1b[38;2;120;169;255m    \x1b[0m';
    const newText = '\x1b[38;2;120;169;255mBOB \x1b[0m';
    
    const segments = findDiffSegments(oldText, newText);
    
    console.log('\n=== COLOR WRAPS ENTIRE LINE ===');
    segments.forEach((seg, i) => {
      console.log(`Segment ${i}: start=${seg.start}, text=${JSON.stringify(seg.text)}`);
    });
    
    // The segment should include the color code at the start
    const firstSegment = segments[0];
    expect(firstSegment?.text).toContain('\x1b[38;2;120;169;255m');
  });

  it('should identify if spaces-to-chars transition loses color', () => {
    const root = new ElementNode('div');

    // Start with colored spaces
    mockExtractLines.mockReturnValue({
      static: [],
      dynamic: ['\x1b[38;2;120;169;255m   \x1b[0m']
    });
    render(root, global.process);
    
    const firstRaw = fakeTTY.getOutputSinceClear();
    console.log('\n=== INITIAL COLORED SPACES ===');
    console.log('Raw:', JSON.stringify(firstRaw));
    
    fakeTTY.clear();

    // Change to colored characters
    mockExtractLines.mockReturnValue({
      static: [],
      dynamic: ['\x1b[38;2;120;169;255mBOB\x1b[0m']
    });
    render(root, global.process);

    const secondRaw = fakeTTY.getOutputSinceClear();
    console.log('\n=== CHANGED TO COLORED CHARS ===');
    console.log('Raw:', JSON.stringify(secondRaw));
    
    // Check if color is present
    const hasColor = secondRaw.includes('\x1b[38;2;120;169;255m');
    console.log('Has color in update:', hasColor);
    
    expect(hasColor).toBe(true);
  });
});
