import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render } from '../src/render/apply-term-updates';
import ElementNode from '../src/dom/nodes/ElementNode';
import { extractLines } from '../src/render/collect-lines';
import { FakeTTY } from '../src/test-utils/FakeTTY';

// Mock extractLines
vi.mock('../src/render/collect-lines', () => ({
  extractLines: vi.fn()
}));

describe('updateLineMinimal Color Bug', () => {
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

  it('BUG: should preserve background color when updating middle of line', () => {
    const root = new ElementNode('div');

    // First render - line with blue background
    mockExtractLines.mockReturnValue({
      static: [],
      dynamic: ['\x1b[44mBlue Background Old Text\x1b[0m']
    });
    render(root, global.process);
    
    const firstOutput = fakeTTY.getFullOutput();
    const firstRawOutput = fakeTTY.output.join('');
    console.log('First render output:', firstOutput);
    console.log('First RAW output:', JSON.stringify(firstRawOutput));
    
    fakeTTY.clear();

    // Second render - update "Old" to "New" but keep blue background
    mockExtractLines.mockReturnValue({
      static: [],
      dynamic: ['\x1b[44mBlue Background New Text\x1b[0m']
    });
    render(root, global.process);

    const updateOutput = fakeTTY.getFullOutput();
    const updateRawOutput = fakeTTY.getOutputSinceClear();
    console.log('Update output:', updateOutput);
    console.log('Update RAW output:', JSON.stringify(updateRawOutput));
    
    // The bug: updateLineMinimal does buffer.push('\x1b[0m') before segment.text
    // This resets the background color, then applies it again
    // But if there's a gap or timing issue, the background might not be continuous
    
    // Check that blue background code is present in the update
    expect(updateOutput).toContain('\x1b[44m');
    
    // Check that the update includes "New"
    expect(updateOutput).toContain('New');
    
    // After the fix, the segment includes "New Text" with background color
    // The sequence should be: cursor move -> reset -> blue BG -> "New Text"
    expect(updateOutput).toContain('\x1b[44m');
    expect(updateOutput).toContain('New Text');
    
    // Verify the background color comes before the text
    const blueBGIndex = updateOutput.indexOf('\x1b[44m');
    const newTextIndex = updateOutput.indexOf('New Text');
    expect(blueBGIndex).toBeGreaterThan(-1);
    expect(newTextIndex).toBeGreaterThan(blueBGIndex);
  });

  it('BUG: should not lose color when segment starts after position 0', () => {
    const root = new ElementNode('div');

    // First render
    mockExtractLines.mockReturnValue({
      static: [],
      dynamic: ['\x1b[31mRed Text Here\x1b[0m']
    });
    render(root, global.process);
    fakeTTY.clear();

    // Second render - only "Here" changes to "There"
    mockExtractLines.mockReturnValue({
      static: [],
      dynamic: ['\x1b[31mRed Text There\x1b[0m']
    });
    render(root, global.process);

    const updateOutput = fakeTTY.getFullOutput();
    console.log('Segment after position 0 output:', updateOutput);
    
    // Should have red color in the update
    expect(updateOutput).toContain('\x1b[31m');
    expect(updateOutput).toContain('There');
    
    // Verify color comes before text
    const redIndex = updateOutput.lastIndexOf('\x1b[31m');
    const thereIndex = updateOutput.indexOf('There');
    expect(redIndex).toBeGreaterThan(-1);
    expect(thereIndex).toBeGreaterThan(redIndex);
  });

  it('BUG: reset code should not interfere with segment color', () => {
    const root = new ElementNode('div');

    // First render - plain text
    mockExtractLines.mockReturnValue({
      static: [],
      dynamic: ['Plain Text']
    });
    render(root, global.process);
    fakeTTY.clear();

    // Second render - add red color
    mockExtractLines.mockReturnValue({
      static: [],
      dynamic: ['\x1b[31mPlain Text\x1b[0m']
    });
    render(root, global.process);

    const updateOutput = fakeTTY.getFullOutput();
    console.log('Reset interference output:', updateOutput);
    
    // After the fix, the entire "Plain Text" is included in the segment with red color
    expect(updateOutput).toContain('\x1b[31m');
    expect(updateOutput).toContain('Plain Text');
    
    // Verify red color comes before the text
    const redColorIndex = updateOutput.indexOf('\x1b[31m');
    const plainIndex = updateOutput.indexOf('Plain Text');
    expect(redColorIndex).toBeGreaterThan(-1);
    expect(plainIndex).toBeGreaterThan(redColorIndex);
  });

  it('BUG: multiple segments with different colors should all render correctly', () => {
    const root = new ElementNode('div');

    // First render
    mockExtractLines.mockReturnValue({
      static: [],
      dynamic: ['\x1b[31mRed\x1b[0m \x1b[32mGreen\x1b[0m']
    });
    render(root, global.process);
    fakeTTY.clear();

    // Second render - change both colors
    mockExtractLines.mockReturnValue({
      static: [],
      dynamic: ['\x1b[34mBlue\x1b[0m \x1b[33mYellow\x1b[0m']
    });
    render(root, global.process);

    const updateOutput = fakeTTY.getFullOutput();
    console.log('Multiple segments output:', updateOutput);
    
    // Should have both new colors
    expect(updateOutput).toContain('\x1b[34m'); // Blue
    expect(updateOutput).toContain('\x1b[33m'); // Yellow
    
    // Should have the text
    expect(updateOutput).toContain('Blue');
    expect(updateOutput).toContain('Yellow');
  });

  it('BUG: color should persist across unchanged characters in segment', () => {
    const root = new ElementNode('div');

    // First render
    mockExtractLines.mockReturnValue({
      static: [],
      dynamic: ['\x1b[31mRed ABCDEF\x1b[0m']
    });
    render(root, global.process);
    fakeTTY.clear();

    // Second render - change only "DEF" to "XYZ"
    mockExtractLines.mockReturnValue({
      static: [],
      dynamic: ['\x1b[31mRed ABCXYZ\x1b[0m']
    });
    render(root, global.process);

    const updateOutput = fakeTTY.getFullOutput();
    console.log('Color persistence output:', updateOutput);
    
    // Should include red color for the changed part
    expect(updateOutput).toContain('\x1b[31m');
    expect(updateOutput).toContain('XYZ');
  });

  it('BUG: background color should not bleed into spaces', () => {
    const root = new ElementNode('div');

    // First render - text with background
    mockExtractLines.mockReturnValue({
      static: [],
      dynamic: ['\x1b[44mBlue BG\x1b[0m    ']
    });
    render(root, global.process);
    fakeTTY.clear();

    // Second render - remove trailing spaces
    mockExtractLines.mockReturnValue({
      static: [],
      dynamic: ['\x1b[44mBlue BG\x1b[0m']
    });
    render(root, global.process);

    const updateOutput = fakeTTY.getFullOutput();
    console.log('Background bleed output:', updateOutput);
    
    // Should clear the trailing spaces without blue background
    // The spaces used to clear should come AFTER the reset code
    const lastResetIndex = updateOutput.lastIndexOf('\x1b[0m');
    const trailingSpaces = updateOutput.substring(lastResetIndex + 4); // After reset code
    
    // Trailing spaces should not have background color code
    expect(trailingSpaces).not.toContain('\x1b[44m');
  });
});
