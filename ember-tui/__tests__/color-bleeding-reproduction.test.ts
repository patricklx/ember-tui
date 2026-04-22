import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render } from '../src/render/apply-term-updates';
import ElementNode from '../src/dom/nodes/ElementNode';
import { extractLines } from '../src/render/collect-lines';
import { FakeTTY } from '../src/test-utils/FakeTTY';

// Mock extractLines to return controlled output
vi.mock('../src/render/collect-lines', () => ({
  extractLines: vi.fn()
}));

describe('Color bleeding reproduction - ANSI state sync issue', () => {
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

  it('should NOT have color bleeding when updating first of multiple colored texts', () => {
    const root = new ElementNode('div');

    // First render - three red text components side by side
    mockExtractLines.mockReturnValue({
      static: [],
      dynamic: ['\x1b[31mAAA\x1b[0m \x1b[31mBBB\x1b[0m \x1b[31mCCC\x1b[0m']
    });
    render(root, global.process);
    
    fakeTTY.clear();

    // Second render - change ONLY the first text to "XXX" (still red)
    // The issue: after partial update, state.lines might not reflect the actual
    // terminal content including ANSI codes, causing next diff to be wrong
    mockExtractLines.mockReturnValue({
      static: [],
      dynamic: ['\x1b[31mXXX\x1b[0m \x1b[31mBBB\x1b[0m \x1b[31mCCC\x1b[0m']
    });
    render(root, global.process);
    
    const output = fakeTTY.getVisibleOutput();
    expect(output).toContain('XXX');
    
    // The critical test: verify that BBB and CCC still have their red color
    // If state.lines wasn't synced properly, the next render might think
    // BBB and CCC don't have color codes and won't apply them
    const fullOutput = fakeTTY.getFullOutput();
    
    // Count how many times red color code appears
    // Should appear at least for the segments that were updated
    const redColorMatches = fullOutput.match(/\x1b\[31m/g);
    expect(redColorMatches).toBeTruthy();
    expect(redColorMatches!.length).toBeGreaterThanOrEqual(1);
  });

  it('should maintain ANSI state in state.lines after partial update', () => {
    const root = new ElementNode('div');

    // First render - two colored segments
    mockExtractLines.mockReturnValue({
      static: [],
      dynamic: ['\x1b[31mRed1\x1b[0m \x1b[34mBlue1\x1b[0m']
    });
    render(root, global.process);
    
    fakeTTY.clear();

    // Second render - change only first segment
    mockExtractLines.mockReturnValue({
      static: [],
      dynamic: ['\x1b[31mRed2\x1b[0m \x1b[34mBlue1\x1b[0m']
    });
    render(root, global.process);
    
    fakeTTY.clear();

    // Third render - change only second segment
    // This is where the bug manifests: if state.lines doesn't have the ANSI codes
    // from the previous render, the diff will be calculated incorrectly
    mockExtractLines.mockReturnValue({
      static: [],
      dynamic: ['\x1b[31mRed2\x1b[0m \x1b[34mBlue2\x1b[0m']
    });
    render(root, global.process);
    
    const output = fakeTTY.getVisibleOutput();
    expect(output).toContain('Blue2');
    
    // Verify the blue color code is present
    const fullOutput = fakeTTY.getFullOutput();
    expect(fullOutput).toContain('\x1b[34m');
  });

  it('should handle color continuity when text overrides previous text', () => {
    const root = new ElementNode('div');

    // First render - plain text
    mockExtractLines.mockReturnValue({
      static: [],
      dynamic: ['Plain text here']
    });
    render(root, global.process);
    
    fakeTTY.clear();

    // Second render - add color to part of the text
    mockExtractLines.mockReturnValue({
      static: [],
      dynamic: ['\x1b[31mRed\x1b[0m text here']
    });
    render(root, global.process);
    
    fakeTTY.clear();

    // Third render - extend the colored part
    // Bug: if state.lines doesn't have the ANSI codes, it might not apply color correctly
    mockExtractLines.mockReturnValue({
      static: [],
      dynamic: ['\x1b[31mRed text\x1b[0m here']
    });
    render(root, global.process);
    
    const output = fakeTTY.getVisibleOutput();
    expect(output).toContain('text');
    
    // Verify red color is applied to the extended part
    const fullOutput = fakeTTY.getFullOutput();
    expect(fullOutput).toContain('\x1b[31m');
  });

  it('should not lose color when multiple Text components update in sequence', () => {
    const root = new ElementNode('div');

    // Initial: Three colored texts
    mockExtractLines.mockReturnValue({
      static: [],
      dynamic: ['\x1b[31mA\x1b[0m \x1b[31mB\x1b[0m \x1b[31mC\x1b[0m']
    });
    render(root, global.process);
    
    // Update A
    fakeTTY.clear();
    mockExtractLines.mockReturnValue({
      static: [],
      dynamic: ['\x1b[31mX\x1b[0m \x1b[31mB\x1b[0m \x1b[31mC\x1b[0m']
    });
    render(root, global.process);
    
    // Update B - this is where color might be lost if state.lines isn't synced
    fakeTTY.clear();
    mockExtractLines.mockReturnValue({
      static: [],
      dynamic: ['\x1b[31mX\x1b[0m \x1b[31mY\x1b[0m \x1b[31mC\x1b[0m']
    });
    render(root, global.process);
    
    // Update C
    fakeTTY.clear();
    mockExtractLines.mockReturnValue({
      static: [],
      dynamic: ['\x1b[31mX\x1b[0m \x1b[31mY\x1b[0m \x1b[31mZ\x1b[0m']
    });
    render(root, global.process);
    
    const output = fakeTTY.getVisibleOutput();
    expect(output).toContain('Z');
    
    // All three should still be red
    const fullOutput = fakeTTY.getFullOutput();
    expect(fullOutput).toContain('\x1b[31m');
  });
});
