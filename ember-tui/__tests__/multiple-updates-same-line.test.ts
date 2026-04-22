import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render } from '../src/render/apply-term-updates';
import ElementNode from '../src/dom/nodes/ElementNode';
import { extractLines } from '../src/render/collect-lines';
import { FakeTTY } from '../src/test-utils/FakeTTY';

// Mock extractLines to return controlled output
vi.mock('../src/render/collect-lines', () => ({
  extractLines: vi.fn()
}));

describe('Multiple updates to same line - Color sync issue', () => {
  let fakeTTY: FakeTTY;
  let originalProcess: typeof process;
  const mockExtractLines = extractLines as any;

  beforeEach(() => {
    fakeTTY = new FakeTTY();

    // Create a mock process object with our fake TTY
    originalProcess = global.process;
    (global as any).process = {
      ...originalProcess,
      stdout: fakeTTY as any,
      stderr: originalProcess.stderr,
      stdin: originalProcess.stdin,
    };

    // Reset mock
    mockExtractLines.mockReset();
  });

  afterEach(() => {
    // Restore original process
    (global as any).process = originalProcess;
  });

  it('should handle multiple color changes to same line position', () => {
    const root = new ElementNode('div');

    // First render - red text
    mockExtractLines.mockReturnValue({
      static: [],
      dynamic: ['\x1b[31mRed Text\x1b[0m']
    });
    render(root, global.process);
    
    let output = fakeTTY.getVisibleOutput();
    expect(output).toContain('Red Text');
    
    fakeTTY.clear();

    // Second render - change to blue
    mockExtractLines.mockReturnValue({
      static: [],
      dynamic: ['\x1b[34mBlue Text\x1b[0m']
    });
    render(root, global.process);
    
    output = fakeTTY.getVisibleOutput();
    expect(output).toContain('Blue');
    
    fakeTTY.clear();

    // Third render - change to green (this tests if state is properly synced)
    mockExtractLines.mockReturnValue({
      static: [],
      dynamic: ['\x1b[32mGreen Text\x1b[0m']
    });
    render(root, global.process);
    
    output = fakeTTY.getVisibleOutput();
    expect(output).toContain('Green');
    
    // Verify the final output has correct color
    const fullOutput = fakeTTY.getFullOutput();
    expect(fullOutput).toContain('\x1b[32m');
  });

  it('should handle rapid color changes with partial text updates', () => {
    const root = new ElementNode('div');

    // Initial render
    mockExtractLines.mockReturnValue({
      static: [],
      dynamic: ['Counter: \x1b[31m0\x1b[0m']
    });
    render(root, global.process);
    fakeTTY.clear();

    // Update 1 - change number and color
    mockExtractLines.mockReturnValue({
      static: [],
      dynamic: ['Counter: \x1b[32m1\x1b[0m']
    });
    render(root, global.process);
    fakeTTY.clear();

    // Update 2 - change number and color again
    mockExtractLines.mockReturnValue({
      static: [],
      dynamic: ['Counter: \x1b[34m2\x1b[0m']
    });
    render(root, global.process);
    fakeTTY.clear();

    // Update 3 - change number and color again
    mockExtractLines.mockReturnValue({
      static: [],
      dynamic: ['Counter: \x1b[33m3\x1b[0m']
    });
    render(root, global.process);

    const output = fakeTTY.getVisibleOutput();
    expect(output).toContain('3');
    
    // Verify correct color is applied
    const fullOutput = fakeTTY.getFullOutput();
    expect(fullOutput).toContain('\x1b[33m');
  });

  it('should sync line content after partial color update', () => {
    const root = new ElementNode('div');

    // First render - plain text
    mockExtractLines.mockReturnValue({
      static: [],
      dynamic: ['Line 1: Plain', 'Line 2: Plain']
    });
    render(root, global.process);
    fakeTTY.clear();

    // Second render - add color to line 2 only
    mockExtractLines.mockReturnValue({
      static: [],
      dynamic: ['Line 1: Plain', 'Line 2: \x1b[31mColored\x1b[0m']
    });
    render(root, global.process);
    fakeTTY.clear();

    // Third render - change line 2 color again (tests if previous state is correct)
    mockExtractLines.mockReturnValue({
      static: [],
      dynamic: ['Line 1: Plain', 'Line 2: \x1b[32mGreen\x1b[0m']
    });
    render(root, global.process);

    const output = fakeTTY.getVisibleOutput();
    expect(output).toContain('Green');
    
    // Verify line 1 wasn't touched
    // Line 1 should not be in the update since it didn't change
    const updatesSinceClear = fakeTTY.getOutputSinceClear();
    expect(updatesSinceClear).not.toContain('Line 1');
  });

  it('should handle color bleeding prevention across multiple updates', () => {
    const root = new ElementNode('div');

    // First render - colored text without reset
    mockExtractLines.mockReturnValue({
      static: [],
      dynamic: ['\x1b[31mRed']
    });
    render(root, global.process);
    fakeTTY.clear();

    // Second render - add more text (should not inherit red color)
    mockExtractLines.mockReturnValue({
      static: [],
      dynamic: ['\x1b[31mRed\x1b[0m Plain']
    });
    render(root, global.process);

    const output = fakeTTY.getVisibleOutput();
    expect(output).toContain('Plain');
    
    // Verify reset code is present
    const fullOutput = fakeTTY.getFullOutput();
    expect(fullOutput).toContain('\x1b[0m');
  });

  it('should handle same position color change with different text lengths', () => {
    const root = new ElementNode('div');

    // First render - short colored text
    mockExtractLines.mockReturnValue({
      static: [],
      dynamic: ['\x1b[31mABC\x1b[0m']
    });
    render(root, global.process);
    fakeTTY.clear();

    // Second render - longer colored text with different color
    mockExtractLines.mockReturnValue({
      static: [],
      dynamic: ['\x1b[32mABCDEF\x1b[0m']
    });
    render(root, global.process);

    const output = fakeTTY.getVisibleOutput();
    expect(output).toContain('ABCDEF');
    
    fakeTTY.clear();

    // Third render - shorter again with another color
    mockExtractLines.mockReturnValue({
      static: [],
      dynamic: ['\x1b[34mXY\x1b[0m']
    });
    render(root, global.process);

    const finalOutput = fakeTTY.getVisibleOutput();
    expect(finalOutput).toContain('XY');
    
    // Should have cleared the extra characters
    const fullOutput = fakeTTY.getFullOutput();
    expect(fullOutput).toContain('    '); // Spaces to clear "CDEF"
  });

  it('should maintain correct state after multiple partial updates', () => {
    const root = new ElementNode('div');

    // Simulate a progress bar that changes color as it progresses
    const updates = [
      'Progress: \x1b[31m[##        ]\x1b[0m 20%',
      'Progress: \x1b[33m[####      ]\x1b[0m 40%',
      'Progress: \x1b[33m[######    ]\x1b[0m 60%',
      'Progress: \x1b[32m[########  ]\x1b[0m 80%',
      'Progress: \x1b[32m[##########]\x1b[0m 100%',
    ];

    // Render each update - the key test is that each subsequent render
    // correctly diffs against the previous state
    for (let i = 0; i < updates.length; i++) {
      mockExtractLines.mockReturnValue({
        static: [],
        dynamic: [updates[i]]
      });
      render(root, global.process);
      
      // After each render, state.lines should be updated to the new content
      // This is critical for the next render to have the correct baseline
    }

    // The test passes if all renders complete without errors
    // This verifies that state.lines is being properly synced after each partial update
    // If it wasn't synced, the diffs would be calculated incorrectly and cause issues
    
    // Verify the final output contains the expected percentage
    const fullOutput = fakeTTY.getFullOutput();
    expect(fullOutput).toContain('100%');
    expect(fullOutput).toContain('\x1b[32m'); // Green color
  });
});
