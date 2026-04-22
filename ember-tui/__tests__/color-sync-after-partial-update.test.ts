import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render } from '../src/render/apply-term-updates';
import ElementNode from '../src/dom/nodes/ElementNode';
import { extractLines } from '../src/render/collect-lines';
import { FakeTTY } from '../src/test-utils/FakeTTY';

// Mock extractLines to return controlled output
vi.mock('../src/render/collect-lines', () => ({
  extractLines: vi.fn()
}));

describe('Color sync after partial update', () => {
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

  it('should correctly track ANSI state after partial color update', () => {
    const root = new ElementNode('div');

    // First render - plain text "Hello World"
    mockExtractLines.mockReturnValue({
      static: [],
      dynamic: ['Hello World']
    });
    render(root, global.process);
    fakeTTY.clear();

    // Second render - change "World" to red, keep "Hello " unchanged
    // This triggers a partial update - only "World" segment should be written
    mockExtractLines.mockReturnValue({
      static: [],
      dynamic: ['Hello \x1b[31mWorld\x1b[0m']
    });
    render(root, global.process);
    
    const output1 = fakeTTY.getFullOutput();
    console.log('After 2nd render:', JSON.stringify(output1));
    fakeTTY.clear();

    // Third render - change "World" to blue
    // This is the critical test: the diff should be calculated against what's
    // ACTUALLY on the terminal (Hello + red World), not against the full
    // "Hello \x1b[31mWorld\x1b[0m" that was in newLines
    mockExtractLines.mockReturnValue({
      static: [],
      dynamic: ['Hello \x1b[34mWorld\x1b[0m']
    });
    render(root, global.process);
    
    const output2 = fakeTTY.getFullOutput();
    console.log('After 3rd render:', JSON.stringify(output2));
    
    // Verify the output contains blue color code
    expect(output2).toContain('\x1b[34m');
    expect(output2).toContain('World');
  });

  it('should handle multiple partial updates with different colors at same position', () => {
    const root = new ElementNode('div');

    // Initial: "Status: OK"
    mockExtractLines.mockReturnValue({
      static: [],
      dynamic: ['Status: OK']
    });
    render(root, global.process);
    fakeTTY.clear();

    // Update 1: Change "OK" to green "OK"
    mockExtractLines.mockReturnValue({
      static: [],
      dynamic: ['Status: \x1b[32mOK\x1b[0m']
    });
    render(root, global.process);
    console.log('After green OK:', JSON.stringify(fakeTTY.getFullOutput()));
    fakeTTY.clear();

    // Update 2: Change to yellow "WARN"
    mockExtractLines.mockReturnValue({
      static: [],
      dynamic: ['Status: \x1b[33mWARN\x1b[0m']
    });
    render(root, global.process);
    console.log('After yellow WARN:', JSON.stringify(fakeTTY.getFullOutput()));
    fakeTTY.clear();

    // Update 3: Change to red "ERROR"
    mockExtractLines.mockReturnValue({
      static: [],
      dynamic: ['Status: \x1b[31mERROR\x1b[0m']
    });
    render(root, global.process);
    
    const finalOutput = fakeTTY.getFullOutput();
    console.log('After red ERROR:', JSON.stringify(finalOutput));
    
    // Should show ERROR in red
    expect(finalOutput).toContain('\x1b[31m');
    expect(finalOutput).toContain('ERROR');
  });

  it('should sync state.lines with actual terminal content after partial update', () => {
    const root = new ElementNode('div');

    // Render: "Line 1" and "Line 2"
    mockExtractLines.mockReturnValue({
      static: [],
      dynamic: ['Line 1', 'Line 2']
    });
    render(root, global.process);
    fakeTTY.clear();

    // Update only Line 2 with color
    mockExtractLines.mockReturnValue({
      static: [],
      dynamic: ['Line 1', '\x1b[32mLine 2\x1b[0m']
    });
    render(root, global.process);
    
    // Verify Line 2 has the green color
    const output1 = fakeTTY.getFullOutput();
    console.log('After coloring Line 2:', JSON.stringify(output1));
    expect(output1).toContain('\x1b[32m');
    expect(output1).toContain('Line 2');
    fakeTTY.clear();

    // Now change Line 2 color again - this tests if state was synced correctly
    mockExtractLines.mockReturnValue({
      static: [],
      dynamic: ['Line 1', '\x1b[34mLine 2\x1b[0m']
    });
    render(root, global.process);
    
    const output2 = fakeTTY.getFullOutput();
    console.log('After changing to blue:', JSON.stringify(output2));
    
    // Should update to blue
    expect(output2).toContain('\x1b[34m');
  });
});
