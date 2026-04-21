import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render } from '../src/render/apply-term-updates';
import ElementNode from '../src/dom/nodes/ElementNode';
import { extractLines } from '../src/render/collect-lines';
import { FakeTTY } from '../src/test-utils/FakeTTY';

vi.mock('../src/render/collect-lines', () => ({
  extractLines: vi.fn()
}));

describe('Actual Rendering Gray Bug', () => {
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

  it('CRITICAL: should render middle character with red color, not gray', () => {
    const root = new ElementNode('div');

    // First render - plain text
    mockExtractLines.mockReturnValue({
      static: [],
      dynamic: ['A B C']
    });
    render(root, global.process);
    
    const firstOutput = fakeTTY.getFullOutput();
    console.log('\n=== FIRST RENDER ===');
    console.log('Output:', firstOutput);
    console.log('Should be plain: A B C');
    
    fakeTTY.clear();

    // Second render - middle B should be RED
    mockExtractLines.mockReturnValue({
      static: [],
      dynamic: ['A \x1b[31mB\x1b[0m C']
    });
    render(root, global.process);

    const secondOutput = fakeTTY.getFullOutput();
    const rawOutput = fakeTTY.getOutputSinceClear();
    
    console.log('\n=== SECOND RENDER (B should be RED) ===');
    console.log('Visual output:', secondOutput);
    console.log('Raw output:', JSON.stringify(rawOutput));
    
    // Parse the raw output to see what's actually written
    const parts = rawOutput.split(/(\x1b\[[0-9;]*m)/);
    console.log('\nParsed parts:');
    parts.forEach((part, i) => {
      if (part.startsWith('\x1b[')) {
        console.log(`  [${i}] ANSI: ${JSON.stringify(part)}`);
      } else if (part) {
        console.log(`  [${i}] TEXT: ${JSON.stringify(part)}`);
      }
    });
    
    // Check the sequence around B
    const bIndex = rawOutput.indexOf('B');
    if (bIndex !== -1) {
      const before = rawOutput.substring(Math.max(0, bIndex - 20), bIndex);
      const after = rawOutput.substring(bIndex + 1, Math.min(rawOutput.length, bIndex + 20));
      console.log('\nContext around B:');
      console.log('  Before B:', JSON.stringify(before));
      console.log('  After B:', JSON.stringify(after));
    }
    
    // The critical check: B should have red color code before it
    expect(rawOutput).toContain('\x1b[31m');
    expect(rawOutput).toContain('B');
    
    // Check that red comes before B
    const redIndex = rawOutput.indexOf('\x1b[31m');
    const bPosition = rawOutput.indexOf('B');
    console.log('\nPosition check:');
    console.log('  Red code at:', redIndex);
    console.log('  B at:', bPosition);
    console.log('  Red before B:', redIndex < bPosition && redIndex !== -1);
    
    expect(redIndex).toBeLessThan(bPosition);
    expect(redIndex).not.toBe(-1);
  });

  it('should show the exact sequence written to terminal for middle red character', () => {
    const root = new ElementNode('div');

    mockExtractLines.mockReturnValue({
      static: [],
      dynamic: ['ABC']
    });
    render(root, global.process);
    fakeTTY.clear();

    mockExtractLines.mockReturnValue({
      static: [],
      dynamic: ['A\x1b[31mB\x1b[0mC']
    });
    render(root, global.process);

    const rawOutput = fakeTTY.getOutputSinceClear();
    
    console.log('\n=== EXACT TERMINAL SEQUENCE ===');
    console.log('Raw:', JSON.stringify(rawOutput));
    
    // Break down every escape sequence
    let pos = 0;
    const sequences: string[] = [];
    while (pos < rawOutput.length) {
      if (rawOutput[pos] === '\x1b') {
        // Find end of escape sequence
        let end = pos + 1;
        while (end < rawOutput.length && !/[a-zA-Z]/.test(rawOutput[end])) {
          end++;
        }
        end++; // Include the letter
        sequences.push(rawOutput.substring(pos, end));
        pos = end;
      } else {
        sequences.push(rawOutput[pos]);
        pos++;
      }
    }
    
    console.log('\nSequence breakdown:');
    sequences.forEach((seq, i) => {
      if (seq.startsWith('\x1b')) {
        console.log(`  [${i}] ${JSON.stringify(seq)} - ${getEscapeDescription(seq)}`);
      } else {
        console.log(`  [${i}] '${seq}'`);
      }
    });
  });
});

function getEscapeDescription(seq: string): string {
  if (seq === '\x1b[?25l') return 'Hide cursor';
  if (seq === '\x1b[?25h') return 'Show cursor';
  if (seq === '\x1b[0m') return 'Reset all';
  if (seq === '\x1b[31m') return 'Red foreground';
  if (seq === '\x1b[32m') return 'Green foreground';
  if (seq === '\x1b[44m') return 'Blue background';
  if (seq.match(/\x1b\[\d+;\d+H/)) return 'Move cursor';
  return 'Unknown';
}
