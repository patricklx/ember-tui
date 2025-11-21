import { describe, it, expect } from 'vitest';
import { tokenize, getActiveAnsiCodes, findDiffSegments } from '../startRender';


describe('tokenize', () => {
  it('should tokenize plain text', () => {
    const tokens = tokenize('hello');
    expect(tokens).toEqual([
      { value: 'h', isAnsi: false, visualLength: 1 },
      { value: 'e', isAnsi: false, visualLength: 1 },
      { value: 'l', isAnsi: false, visualLength: 1 },
      { value: 'l', isAnsi: false, visualLength: 1 },
      { value: 'o', isAnsi: false, visualLength: 1 },
    ]);
  });

  it('should tokenize text with ANSI codes', () => {
    const tokens = tokenize('\x1b[31mred\x1b[0m');
    expect(tokens).toEqual([
      { value: '\x1b[31m', isAnsi: true, visualLength: 0 },
      { value: 'r', isAnsi: false, visualLength: 1 },
      { value: 'e', isAnsi: false, visualLength: 1 },
      { value: 'd', isAnsi: false, visualLength: 1 },
      { value: '\x1b[0m', isAnsi: true, visualLength: 0 },
    ]);
  });

  it('should handle multiple ANSI codes', () => {
    const tokens = tokenize('\x1b[31m\x1b[1mred\x1b[0m');
    expect(tokens).toEqual([
      { value: '\x1b[31m', isAnsi: true, visualLength: 0 },
      { value: '\x1b[1m', isAnsi: true, visualLength: 0 },
      { value: 'r', isAnsi: false, visualLength: 1 },
      { value: 'e', isAnsi: false, visualLength: 1 },
      { value: 'd', isAnsi: false, visualLength: 1 },
      { value: '\x1b[0m', isAnsi: true, visualLength: 0 },
    ]);
  });
});

describe('getActiveAnsiCodes', () => {
  it('should return empty string for plain text', () => {
    const tokens = tokenize('hello');
    expect(getActiveAnsiCodes(tokens, 2)).toBe('');
  });

  it('should return active ANSI codes up to position', () => {
    const tokens = tokenize('\x1b[31mred text');
    expect(getActiveAnsiCodes(tokens, 2)).toBe('\x1b[31m');
  });

  it('should accumulate multiple ANSI codes', () => {
    const tokens = tokenize('\x1b[31m\x1b[1mred text');
    expect(getActiveAnsiCodes(tokens, 2)).toBe('\x1b[31m\x1b[1m');
  });

  it('should not include codes after position', () => {
    const tokens = tokenize('he\x1b[31mllo');
    expect(getActiveAnsiCodes(tokens, 2)).toBe('');
  });
});

describe('findDiffSegments', () => {

  // Helper function to convert visual position to actual string position
  function visualToStringPosition(text: string, visualPos: number): number {
    const tokens = tokenize(text);
    let currentVisualPos = 0;
    let stringPos = 0;

    for (const token of tokens) {
      if (currentVisualPos >= visualPos) {
        break;
      }
      stringPos += token.value.length;
      currentVisualPos += token.visualLength;
    }

    return stringPos;
  }

  it('should handle partial text replacement with same colors 1', () => {
    // Use raw ANSI codes instead of chalk (chalk may strip codes in test environment)
    const oldText = '\x1b[32m\x1b[1mLorem Ipsum Generator\x1b[0m';
    const newText = '\x1b[32m\x1b[1mColors Demo View\x1b[0m';
    const segments = findDiffSegments(oldText, newText);

    expect(segments).toMatchInlineSnapshot(`
      [
        {
          "start": 0,
          "text": "[32m[1mC",
        },
        {
          "start": 2,
          "text": "[32m[1mlors Demo",
        },
        {
          "start": 12,
          "text": "[32m[1mView",
        },
        {
          "start": 16,
          "text": "",
        },
      ]
    `);
  })

  it('should handle partial text replacement with same colors 2', () => {
    // Use raw ANSI codes instead of chalk (chalk may strip codes in test environment)
    const oldText = '\x1b[32m\x1b[1mLorem Ipsum Generator\x1b[0m';
    const newText = '\x1b[32m\x1b[1mLorem Ipsum Generator Second\x1b[0m';
    const segments = findDiffSegments(oldText, newText);

    expect(segments).toMatchInlineSnapshot(`
      [
        {
          "start": 21,
          "text": "[32m[1m Second",
        },
      ]
    `);
  })

  it('should handle complete text replacement with different colors 1', () => {
    // Use raw ANSI codes instead of chalk (chalk may strip codes in test environment)
    const oldText = '\x1b[35m\x1b[1mLorem Ipsum Generator\x1b[0m';
    const newText = '\x1b[32m\x1b[1mColors Demo View\x1b[0m';
    const segments = findDiffSegments(oldText, newText);

    expect(segments).toMatchInlineSnapshot(`
      [
        {
          "start": 0,
          "text": "[32m[1mColors Demo View",
        },
        {
          "start": 16,
          "text": "",
        },
      ]
    `);
  })

  it('should handle complete text replacement with different colors 2', () => {
    // Use raw ANSI codes instead of chalk (chalk may strip codes in test environment)
    const oldText = '\x1b[35m\x1b[1mLorem Ipsum Generator\x1b[0m';
    const newText = '\x1b[35m\x1b[1mLorem Ipsum \x1b[32m\x1b[1mGenerator\x1b[0m';
    const segments = findDiffSegments(oldText, newText);

    expect(segments).toMatchInlineSnapshot(`
      [
        {
          "start": 12,
          "text": "[32m[1mGenerator",
        },
      ]
    `);
  })

  it('should handle complete text replacement with different colors 3', () => {
    // Use raw ANSI codes instead of chalk (chalk may strip codes in test environment)
    const oldText = '\x1b[35m\x1b[1mLorem Ipsum \x1b[35m\x1b[1mGenerator\x1b[0m';
    const newText = '\x1b[35m\x1b[1mLorem \x1b[32m\x1b[1mIpsum \x1b[35m\x1b[1mGenerator\x1b[0m';    const segments = findDiffSegments(oldText, newText);

    // Generator should NOT be in the segment because:
    // - In oldText: "Generator" has color [35m[1m
    // - In newText: "Generator" has color [35m[1m
    // - Both text and color are identical, so no update needed
    expect(segments).toMatchInlineSnapshot(`
      [
        {
          "start": 6,
          "text": "[32m[1mIpsum ",
        },
      ]
    `);
  })

  it('should return empty array for identical strings', () => {
    const segments = findDiffSegments('hello', 'hello');
    expect(segments).toEqual([]);
  });

  it('should find single character difference', () => {
    const segments = findDiffSegments('hello', 'hallo');
    expect(segments).toEqual([
      { start: 1, text: 'a' }
    ]);
  });

  it('should handle color changes in middle of text', () => {
    const oldText = '\x1b[31mred\x1b[0m text';
    const newText = '\x1b[32mgreen\x1b[0m text';
    const segments = findDiffSegments(oldText, newText);

    // Should detect the color code change and text change
    expect(segments.length).toBeGreaterThan(0);
    expect(segments[0].start).toBe(0);
    // Should include the new color code
    expect(segments[0].text).toContain('\x1b[32m');
  });

  it('should prepend active ANSI codes to mid-line changes', () => {
    const oldText = '\x1b[31mred text here\x1b[0m';
    const newText = '\x1b[31mred test here\x1b[0m';
    const segments = findDiffSegments(oldText, newText);

    // The algorithm only detects the single character difference: 'x' -> 's'
    // This is at visual position 6 (r=0, e=1, d=2, space=3, t=4, e=5, x=6)
    expect(segments.length).toBe(1);
    expect(segments[0].start).toBe(6);
    // Should prepend the active red color code
    expect(segments[0].text).toContain('\x1b[31m');
    expect(segments[0].text).toContain('s');
  });

  it('should handle text becoming colored', () => {
    const oldText = 'plain text';
    const newText = '\x1b[31mplain\x1b[0m text';
    const segments = findDiffSegments(oldText, newText);

    expect(segments.length).toBeGreaterThan(0);
    // Should include the color codes in the segment
    expect(segments[0].text).toContain('\x1b[31m');
  });

  it('should handle color removal', () => {
    const oldText = '\x1b[31mcolored\x1b[0m text';
    const newText = 'colored text';
    const segments = findDiffSegments(oldText, newText);

    expect(segments.length).toBeGreaterThan(0);
  });

  it('should handle multiple color changes in one line', () => {
    const oldText = '\x1b[31mred\x1b[0m \x1b[32mgreen\x1b[0m';
    const newText = '\x1b[31mred\x1b[0m \x1b[34mblue\x1b[0m';
    const segments = findDiffSegments(oldText, newText);

    // Should detect the color change from green to blue
    expect(segments.length).toBeGreaterThan(0);
    
    // Find segment that contains 'blue' or the blue color code
    const blueSegment = segments.find(s => s.text.includes('blue') || s.text.includes('\x1b[34m'));
    expect(blueSegment).toBeDefined();
    expect(blueSegment?.text).toContain('\x1b[34m');
  });
});