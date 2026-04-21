import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render } from '../src/render/apply-term-updates';
import ElementNode from '../src/dom/nodes/ElementNode';
import { extractLines } from '../src/render/collect-lines';
import { FakeTTY } from '../src/test-utils/FakeTTY';

vi.mock('../src/render/collect-lines', () => ({
  extractLines: vi.fn()
}));

describe('Multi-Segment Rendering Bug', () => {
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

  it('should handle multiple color changes at different positions', () => {
    const root = new ElementNode('div');

    // First render - plain text with spaces
    mockExtractLines.mockReturnValue({
      static: [],
      dynamic: ['A B C D E']
    });
    render(root, global.process);
    
    const firstOutput = fakeTTY.getFullOutput();
    console.log('First render:', firstOutput);
    
    fakeTTY.clear();

    // Second render - alternating colors
    mockExtractLines.mockReturnValue({
      static: [],
      dynamic: ['\x1b[31mA\x1b[0m \x1b[32mB\x1b[0m \x1b[31mC\x1b[0m \x1b[32mD\x1b[0m \x1b[31mE\x1b[0m']
    });
    render(root, global.process);

    const updateOutput = fakeTTY.getFullOutput();
    const updateRaw = fakeTTY.getOutputSinceClear();
    console.log('Update output:', updateOutput);
    console.log('Update RAW:', JSON.stringify(updateRaw));
    
    // Check that all colors are present
    expect(updateOutput).toContain('A');
    expect(updateOutput).toContain('B');
    expect(updateOutput).toContain('C');
    expect(updateOutput).toContain('D');
    expect(updateOutput).toContain('E');
    
    // Verify colors are applied
    expect(updateRaw).toContain('\x1b[31m'); // Red
    expect(updateRaw).toContain('\x1b[32m'); // Green
  });

  it('should handle spaces being replaced with colored numbers', () => {
    const root = new ElementNode('div');

    // First render
    mockExtractLines.mockReturnValue({
      static: [],
      dynamic: ['A B C D E']
    });
    render(root, global.process);
    fakeTTY.clear();

    // Second render - numbers in place of spaces with colors
    mockExtractLines.mockReturnValue({
      static: [],
      dynamic: ['A\x1b[31m1\x1b[0mB\x1b[32m2\x1b[0mC\x1b[33m3\x1b[0mD E']
    });
    render(root, global.process);

    const updateOutput = fakeTTY.getFullOutput();
    const updateRaw = fakeTTY.getOutputSinceClear();
    console.log('Spaces replaced output:', updateOutput);
    console.log('Spaces replaced RAW:', JSON.stringify(updateRaw));
    
    // Check that numbers are present
    expect(updateOutput).toContain('1');
    expect(updateOutput).toContain('2');
    expect(updateOutput).toContain('3');
    
    // Verify colors are applied to numbers
    expect(updateRaw).toContain('\x1b[31m'); // Red for 1
    expect(updateRaw).toContain('\x1b[32m'); // Green for 2
    expect(updateRaw).toContain('\x1b[33m'); // Yellow for 3
  });

  it('should handle progressive updates at different positions', () => {
    const root = new ElementNode('div');

    // Step 1: Initial
    mockExtractLines.mockReturnValue({
      static: [],
      dynamic: ['A B C D E']
    });
    render(root, global.process);
    fakeTTY.clear();

    // Step 2: Add 1 after A
    mockExtractLines.mockReturnValue({
      static: [],
      dynamic: ['A\x1b[31m1\x1b[0mB C D E']
    });
    render(root, global.process);
    
    let updateOutput = fakeTTY.getFullOutput();
    console.log('Step 2 output:', updateOutput);
    expect(updateOutput).toContain('1');
    
    fakeTTY.clear();

    // Step 3: Add 2 after B
    mockExtractLines.mockReturnValue({
      static: [],
      dynamic: ['A\x1b[31m1\x1b[0mB\x1b[32m2\x1b[0mC D E']
    });
    render(root, global.process);
    
    updateOutput = fakeTTY.getFullOutput();
    console.log('Step 3 output:', updateOutput);
    expect(updateOutput).toContain('2');
    
    fakeTTY.clear();

    // Step 4: Add 3 after C
    mockExtractLines.mockReturnValue({
      static: [],
      dynamic: ['A\x1b[31m1\x1b[0mB\x1b[32m2\x1b[0mC\x1b[33m3\x1b[0mD E']
    });
    render(root, global.process);
    
    updateOutput = fakeTTY.getFullOutput();
    console.log('Step 4 output:', updateOutput);
    expect(updateOutput).toContain('3');
  });

  it('should handle the case where reset code between segments causes issues', () => {
    const root = new ElementNode('div');

    // First render
    mockExtractLines.mockReturnValue({
      static: [],
      dynamic: ['ABCDE']
    });
    render(root, global.process);
    fakeTTY.clear();

    // Second render - each char with different color
    mockExtractLines.mockReturnValue({
      static: [],
      dynamic: ['\x1b[31mA\x1b[0m\x1b[32mB\x1b[0m\x1b[33mC\x1b[0m\x1b[34mD\x1b[0m\x1b[35mE\x1b[0m']
    });
    render(root, global.process);

    const updateOutput = fakeTTY.getFullOutput();
    const updateRaw = fakeTTY.getOutputSinceClear();
    console.log('Each char different color output:', updateOutput);
    console.log('Each char different color RAW:', JSON.stringify(updateRaw));
    
    // All characters should be present
    expect(updateOutput).toContain('A');
    expect(updateOutput).toContain('B');
    expect(updateOutput).toContain('C');
    expect(updateOutput).toContain('D');
    expect(updateOutput).toContain('E');
    
    // All colors should be present
    expect(updateRaw).toContain('\x1b[31m'); // Red
    expect(updateRaw).toContain('\x1b[32m'); // Green
    expect(updateRaw).toContain('\x1b[33m'); // Yellow
    expect(updateRaw).toContain('\x1b[34m'); // Blue
    expect(updateRaw).toContain('\x1b[35m'); // Magenta
  });

  it('should identify if reset codes between segments interfere with colors', () => {
    const root = new ElementNode('div');

    // First render
    mockExtractLines.mockReturnValue({
      static: [],
      dynamic: ['ABC']
    });
    render(root, global.process);
    fakeTTY.clear();

    // Second render - A red, B green, C blue
    mockExtractLines.mockReturnValue({
      static: [],
      dynamic: ['\x1b[31mA\x1b[0m\x1b[32mB\x1b[0m\x1b[33mC\x1b[0m']
    });
    render(root, global.process);

    const updateRaw = fakeTTY.getOutputSinceClear();
    console.log('Reset interference RAW:', JSON.stringify(updateRaw));
    
    // Count how many times we reset
    const resetCount = (updateRaw.match(/\x1b\[0m/g) || []).length;
    console.log('Number of resets:', resetCount);
    
    // With the current fix, we should only reset once at the beginning
    // and once at the end, not between each segment
    // But if there are multiple segments, we might have issues
    
    // The key question: does each segment get its own reset?
    // If yes, that could interfere with color continuity
  });
});
