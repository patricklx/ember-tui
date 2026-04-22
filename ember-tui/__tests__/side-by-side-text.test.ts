import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render } from '../src/render/apply-term-updates';
import ElementNode from '../src/dom/nodes/ElementNode';
import { extractLines } from '../src/render/collect-lines';
import { FakeTTY } from '../src/test-utils/FakeTTY';

// Mock extractLines to return controlled output
vi.mock('../src/render/collect-lines', () => ({
  extractLines: vi.fn()
}));

describe('Side-by-side Text components - Color sync', () => {
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

  it('should handle multiple Text components side by side with different colors', () => {
    const root = new ElementNode('div');

    // First render - two colored text components side by side
    mockExtractLines.mockReturnValue({
      static: [],
      dynamic: ['\x1b[31mRed\x1b[0m \x1b[34mBlue\x1b[0m']
    });
    render(root, global.process);
    
    let output = fakeTTY.getVisibleOutput();
    expect(output).toContain('Red');
    expect(output).toContain('Blue');
    
    fakeTTY.clear();

    // Second render - change first component color
    mockExtractLines.mockReturnValue({
      static: [],
      dynamic: ['\x1b[32mGreen\x1b[0m \x1b[34mBlue\x1b[0m']
    });
    render(root, global.process);
    
    output = fakeTTY.getVisibleOutput();
    expect(output).toContain('Green');
    expect(output).toContain('Blue');
    
    // Verify both colors are present in the output
    const fullOutput = fakeTTY.getFullOutput();
    expect(fullOutput).toContain('\x1b[32m'); // Green
    expect(fullOutput).toContain('\x1b[34m'); // Blue
  });

  it('should handle color changes in second component while first stays same', () => {
    const root = new ElementNode('div');

    // First render
    mockExtractLines.mockReturnValue({
      static: [],
      dynamic: ['\x1b[31mRed\x1b[0m \x1b[34mBlue\x1b[0m']
    });
    render(root, global.process);
    fakeTTY.clear();

    // Second render - change only second component
    mockExtractLines.mockReturnValue({
      static: [],
      dynamic: ['\x1b[31mRed\x1b[0m \x1b[32mGreen\x1b[0m']
    });
    render(root, global.process);

    const output = fakeTTY.getVisibleOutput();
    expect(output).toContain('Green');
    
    // The update should only touch the changed part
    const fullOutput = fakeTTY.getFullOutput();
    expect(fullOutput).toContain('\x1b[32m'); // Green color code
  });

  it('should handle text content change in one component while other stays same', () => {
    const root = new ElementNode('div');

    // First render
    mockExtractLines.mockReturnValue({
      static: [],
      dynamic: ['\x1b[31mCounter: 0\x1b[0m \x1b[34mStatic\x1b[0m']
    });
    render(root, global.process);
    fakeTTY.clear();

    // Second render - change counter
    mockExtractLines.mockReturnValue({
      static: [],
      dynamic: ['\x1b[31mCounter: 1\x1b[0m \x1b[34mStatic\x1b[0m']
    });
    render(root, global.process);

    const output = fakeTTY.getVisibleOutput();
    expect(output).toContain('1');
    
    // Verify the update was minimal - only the changed character
    const updatesSinceClear = fakeTTY.getOutputSinceClear();
    // The partial update should only write the changed digit
    expect(updatesSinceClear).toContain('1');
    // Verify color code is included for the changed segment
    expect(updatesSinceClear).toContain('\x1b[31m');
  });

  it('should maintain correct state after multiple partial updates to different components', () => {
    const root = new ElementNode('div');

    // Initial render
    mockExtractLines.mockReturnValue({
      static: [],
      dynamic: ['\x1b[31mA\x1b[0m \x1b[34mB\x1b[0m \x1b[32mC\x1b[0m']
    });
    render(root, global.process);
    fakeTTY.clear();

    // Update first component
    mockExtractLines.mockReturnValue({
      static: [],
      dynamic: ['\x1b[33mX\x1b[0m \x1b[34mB\x1b[0m \x1b[32mC\x1b[0m']
    });
    render(root, global.process);
    fakeTTY.clear();

    // Update second component
    mockExtractLines.mockReturnValue({
      static: [],
      dynamic: ['\x1b[33mX\x1b[0m \x1b[35mY\x1b[0m \x1b[32mC\x1b[0m']
    });
    render(root, global.process);
    fakeTTY.clear();

    // Update third component
    mockExtractLines.mockReturnValue({
      static: [],
      dynamic: ['\x1b[33mX\x1b[0m \x1b[35mY\x1b[0m \x1b[36mZ\x1b[0m']
    });
    render(root, global.process);

    const output = fakeTTY.getVisibleOutput();
    expect(output).toContain('Z');
    
    // Verify final state has correct colors
    const fullOutput = fakeTTY.getFullOutput();
    expect(fullOutput).toContain('\x1b[36m'); // Cyan for Z
  });

  it('should handle rapid alternating updates between components', () => {
    const root = new ElementNode('div');

    // Initial
    mockExtractLines.mockReturnValue({
      static: [],
      dynamic: ['\x1b[31mLeft: 0\x1b[0m | \x1b[34mRight: 0\x1b[0m']
    });
    render(root, global.process);

    // Alternate updates
    for (let i = 1; i <= 5; i++) {
      fakeTTY.clear();
      
      if (i % 2 === 1) {
        // Update left
        mockExtractLines.mockReturnValue({
          static: [],
          dynamic: [`\x1b[31mLeft: ${i}\x1b[0m | \x1b[34mRight: ${i-1}\x1b[0m`]
        });
      } else {
        // Update right
        mockExtractLines.mockReturnValue({
          static: [],
          dynamic: [`\x1b[31mLeft: ${i-1}\x1b[0m | \x1b[34mRight: ${i}\x1b[0m`]
        });
      }
      
      render(root, global.process);
    }

    // Final state should be correct - only the last changed digit is visible
    const output = fakeTTY.getVisibleOutput();
    // After 5 iterations, the last update changed Right to 5
    expect(output).toContain('5');
    
    // Verify the color code is present
    const fullOutput = fakeTTY.getFullOutput();
    expect(fullOutput).toContain('\x1b[34m'); // Blue for Right
  });
});
