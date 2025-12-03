import { describe, it, expect, beforeEach } from 'vitest';
import { FakeTTY } from '../src/test-utils/FakeTTY';

describe('FakeTTY', () => {
  let tty: FakeTTY;

  beforeEach(() => {
    tty = new FakeTTY();
  });

  describe('basic properties', () => {
    it('should initialize with default dimensions', () => {
      expect(tty.rows).toBe(24);
      expect(tty.columns).toBe(80);
      expect(tty.isTTY).toBe(true);
    });

    it('should track output', () => {
      tty.write('Hello');
      expect(tty.output).toHaveLength(1);
      expect(tty.output[0]).toBe('Hello');
    });
  });

  describe('basic text writing', () => {
    it('should write simple text', () => {
      tty.write('Hello World');
      const output = tty.getCleanOutput();
      expect(output).toBe('Hello World');
    });

    it('should handle newlines', () => {
      tty.write('Line 1\nLine 2\nLine 3');
      const lines = tty.getLines();
      expect(lines).toEqual(['Line 1', 'Line 2', 'Line 3']);
    });

    it('should handle carriage return', () => {
      tty.write('Hello\rWorld');
      const output = tty.getCleanOutput();
      expect(output).toBe('World');
    });

    it('should handle multiple writes', () => {
      tty.write('Hello ');
      tty.write('World');
      const output = tty.getCleanOutput();
      expect(output).toBe('Hello World');
    });
  });

  describe('ANSI color codes', () => {
    it('should preserve color codes in full output', () => {
      tty.write('\x1b[31mRed Text\x1b[0m');
      const fullOutput = tty.getFullOutput();
      expect(fullOutput).toContain('\x1b[31m');
      expect(fullOutput).toContain('Red Text');
      expect(fullOutput).toContain('\x1b[0m');
    });

    it('should strip color codes in clean output', () => {
      tty.write('\x1b[31mRed Text\x1b[0m');
      const cleanOutput = tty.getCleanOutput();
      expect(cleanOutput).toBe('Red Text');
    });

    it('should handle multiple color changes', () => {
      tty.write('\x1b[31mRed\x1b[0m \x1b[32mGreen\x1b[0m \x1b[34mBlue\x1b[0m');
      const cleanOutput = tty.getCleanOutput();
      expect(cleanOutput).toBe('Red Green Blue');
    });

    it('should handle background colors', () => {
      tty.write('\x1b[44mBlue Background\x1b[0m');
      const fullOutput = tty.getFullOutput();
      expect(fullOutput).toContain('\x1b[44m');
      expect(fullOutput).toContain('Blue Background');
    });

    it('should track ANSI state across writes', () => {
      tty.write('\x1b[31m');
      tty.write('Red Text');
      tty.write('\x1b[0m');
      const fullOutput = tty.getFullOutput();
      expect(fullOutput).toContain('\x1b[31m');
      expect(fullOutput).toContain('Red Text');
    });
  });

  describe('cursor positioning', () => {
    it('should move cursor to absolute position', () => {
      tty.cursorTo(10, 5);
      tty.write('X');
      const output = tty.getCleanOutput();
      const lines = output.split('\n');
      expect(lines[5]).toContain('X');
    });

    it('should move cursor with cursorTo (x only)', () => {
      tty.write('Hello');
      tty.cursorTo(0);
      tty.write('X');
      const output = tty.getCleanOutput();
      expect(output).toBe('Xello');
    });

    it('should handle ANSI cursor positioning codes', () => {
      tty.write('\x1b[5;10HX');
      const output = tty.getCleanOutput();
      const lines = output.split('\n');
      expect(lines[4]).toContain('X'); // 5th line (0-indexed as 4)
    });

    it('should move cursor relatively', () => {
      tty.write('Hello');
      tty.moveCursor(-3, 0);
      tty.write('X');
      const output = tty.getCleanOutput();
      expect(output).toContain('HeXlo');
    });

    it('should handle cursor up movement', () => {
      tty.write('Line 1\nLine 2');
      tty.write('\x1b[1A'); // Move up 1 line
      tty.write('X');
      const lines = tty.getLines();
      expect(lines[0]).toContain('X');
    });

    it('should handle cursor down movement', () => {
      tty.write('Line 1');
      tty.write('\x1b[2B'); // Move down 2 lines
      tty.write('X');
      const output = tty.getCleanOutput();
      const lines = output.split('\n');
      expect(lines[2]).toContain('X');
    });

    it('should handle cursor right movement', () => {
      tty.write('Hello');
      tty.write('\x1b[3C'); // Move right 3
      tty.write('X');
      const output = tty.getCleanOutput();
      expect(output).toContain('Hello   X');
    });

    it('should handle cursor left movement', () => {
      tty.write('Hello');
      tty.write('\x1b[3D'); // Move left 3
      tty.write('X');
      const output = tty.getCleanOutput();
      expect(output).toContain('HeXlo');
    });

    it('should handle cursor column positioning', () => {
      tty.write('Hello World');
      tty.write('\x1b[5G'); // Move to column 5 (1-based, so index 4)
      tty.write('X');
      const output = tty.getCleanOutput();
      expect(output).toContain('HellX');
    });
  });

  describe('line clearing', () => {
    it('should clear line from cursor to end (dir=1)', () => {
      tty.write('Hello World');
      tty.cursorTo(5);
      tty.clearLine(1);
      const output = tty.getCleanOutput();
      expect(output).toBe('Hello');
    });

    it('should clear line from start to cursor (dir=-1)', () => {
      tty.write('Hello World');
      tty.cursorTo(5);
      tty.clearLine(-1);
      const output = tty.getCleanOutput();
      expect(output).toContain('World');
    });

    it('should clear entire line (dir=0)', () => {
      tty.write('Hello World');
      tty.clearLine(0);
      const output = tty.getCleanOutput();
      expect(output).toBe('');
    });

    it('should handle ANSI clear to end of line', () => {
      tty.write('Hello World');
      tty.write('\x1b[6G'); // Move to column 6 (after 'Hello')
      tty.write('\x1b[0K'); // Clear to end
      const output = tty.getCleanOutput();
      expect(output).toBe('Hello');
    });

    it('should handle ANSI clear to start of line', () => {
      tty.write('Hello World');
      tty.write('\x1b[5G'); // Move to column 5
      tty.write('\x1b[1K'); // Clear to start
      const output = tty.getCleanOutput();
      expect(output).toContain('World');
    });

    it('should handle ANSI clear entire line', () => {
      tty.write('Hello World');
      tty.write('\x1b[2K'); // Clear entire line
      const output = tty.getCleanOutput();
      expect(output).toBe('');
    });
  });

  describe('screen clearing', () => {
    it('should clear screen with clearScreenDown', () => {
      tty.write('Line 1\nLine 2\nLine 3');
      tty.cursorTo(0, 1);
      tty.clearScreenDown();
      const lines = tty.getLines();
      expect(lines).toEqual(['Line 1']);
    });

    it('should handle ANSI clear screen', () => {
      tty.write('Line 1\nLine 2\nLine 3');
      tty.write('\x1b[2J'); // Clear screen
      const output = tty.getCleanOutput();
      expect(output).toBe('');
    });

    it('should handle ANSI clear screen and scrollback', () => {
      tty.write('Line 1\nLine 2\nLine 3');
      tty.write('\x1b[3J'); // Clear screen and scrollback
      const output = tty.getCleanOutput();
      expect(output).toBe('');
    });

    it('should handle ANSI clear from cursor down', () => {
      tty.write('Line 1\nLine 2\nLine 3');
      tty.write('\x1b[1;1H'); // Move to line 1
      tty.write('\x1b[0J'); // Clear from cursor down
      const lines = tty.getLines();
      expect(lines.length).toBeLessThanOrEqual(1);
    });
  });

  describe('cursor visibility', () => {
    it('should handle hide cursor code', () => {
      tty.write('\x1b[?25l');
      expect(tty.output).toContain('\x1b[?25l');
    });

    it('should handle show cursor code', () => {
      tty.write('\x1b[?25h');
      expect(tty.output).toContain('\x1b[?25h');
    });
  });

  describe('output methods', () => {
    it('should return full output with ANSI codes', () => {
      tty.write('\x1b[31mRed\x1b[0m');
      const fullOutput = tty.getFullOutput();
      expect(fullOutput).toContain('\x1b[31m');
      expect(fullOutput).toContain('\x1b[0m');
    });

    it('should return clean output without ANSI codes', () => {
      tty.write('\x1b[31mRed\x1b[0m \x1b[32mGreen\x1b[0m');
      const cleanOutput = tty.getCleanOutput();
      expect(cleanOutput).toBe('Red Green');
    });

    it('should return visible output without cursor control codes', () => {
      tty.write('\x1b[?25l\x1b[1;1HHello\x1b[?25h');
      const visibleOutput = tty.getVisibleOutput();
      expect(visibleOutput).not.toContain('\x1b[?25l');
      expect(visibleOutput).not.toContain('\x1b[1;1H');
      expect(visibleOutput).not.toContain('\x1b[?25h');
    });

    it('should return lines array', () => {
      tty.write('Line 1\nLine 2\nLine 3');
      const lines = tty.getLines();
      expect(lines).toEqual(['Line 1', 'Line 2', 'Line 3']);
    });

    it('should filter empty lines in getLines', () => {
      tty.write('Line 1\n\nLine 3');
      const lines = tty.getLines();
      expect(lines).toEqual(['Line 1', 'Line 3']);
    });
  });

  describe('clear and reset', () => {
    it('should clear output marker but keep buffer state', () => {
      tty.write('Hello');
      const beforeClear = tty.output.length;
      tty.clear();
      tty.write('World');

      // Output array should still grow
      expect(tty.output.length).toBeGreaterThan(beforeClear);

      // But visible output should only show what's after clear
      const visibleOutput = tty.getVisibleOutput();
      expect(visibleOutput).toContain('World');
    });

    it('should reset TTY to initial state', () => {
      tty.write('Hello World\nLine 2');
      tty.cursorTo(10, 5);
      tty.reset();

      expect(tty.output).toEqual([]);
      expect(tty.rows).toBe(24);
      expect(tty.columns).toBe(80);
      const output = tty.getCleanOutput();
      expect(output).toBe('');
    });
  });

  describe('text exceeding terminal height (scroll buffer)', () => {
    it('should handle text exceeding terminal height', () => {
      // Write more lines than terminal height (24 rows)
      for (let i = 1; i <= 30; i++) {
        tty.write(`Line ${i}\n`);
      }

      const lines = tty.getLines();
      expect(lines.length).toBe(30);

      // All lines should be preserved in buffer
      expect(lines[0]).toBe('Line 1');
      expect(lines[29]).toBe('Line 30');
    });

    it('should maintain buffer integrity when scrolling', () => {
      // Fill terminal with lines
      for (let i = 1; i <= 25; i++) {
        tty.write(`Line ${i}\n`);
      }

      // Move cursor back up and overwrite
      tty.write('\x1b[10A'); // Move up 10 lines
      tty.write('OVERWRITTEN');

      const lines = tty.getLines();
      // Line at position (25 - 10) should contain OVERWRITTEN
      expect(lines[15]).toContain('OVERWRITTEN');
    });

    it('should handle writing beyond initial buffer size', () => {
      // Write way more than 24 lines
      for (let i = 1; i <= 100; i++) {
        tty.write(`Line ${i}\n`);
      }

      const lines = tty.getLines();
      expect(lines.length).toBe(100);
      expect(lines[99]).toBe('Line 100');
    });

    it('should handle cursor positioning beyond terminal height', () => {
      // Position cursor at line 50 (beyond default 24 rows)
      tty.write('\x1b[50;1H');
      tty.write('Deep Line');

      const output = tty.getCleanOutput();
      const lines = output.split('\n');
      expect(lines[49]).toContain('Deep Line');
    });

    it('should preserve content when clearing screen after scrolling', () => {
      // Write many lines
      for (let i = 1; i <= 30; i++) {
        tty.write(`Line ${i}\n`);
      }

      // Clear screen
      tty.write('\x1b[2J');

      // Buffer should be cleared
      const output = tty.getCleanOutput();
      expect(output).toBe('');
    });

    it('should handle mixed operations with scroll buffer', () => {
      // Write lines exceeding terminal height
      for (let i = 1; i <= 30; i++) {
        tty.write(`Line ${i}\n`);
      }

      // Move to middle of buffer
      tty.write('\x1b[15;1H');
      tty.write('INSERTED');

      // Clear from cursor down
      tty.write('\x1b[0J');

      const lines = tty.getLines();
      // Should have lines 1-14 and the inserted line
      expect(lines.length).toBeLessThan(30);
      expect(lines[14]).toContain('INSERTED');
    });

    it('should handle rapid writes exceeding terminal height', () => {
      // Simulate rapid logging that exceeds terminal
      const logLines: string[] = [];
      for (let i = 1; i <= 50; i++) {
        const line = `[${new Date().toISOString()}] Log entry ${i}`;
        logLines.push(line);
        tty.write(line + '\n');
      }

      const lines = tty.getLines();
      expect(lines.length).toBe(50);

      // Verify first and last entries
      expect(lines[0]).toContain('Log entry 1');
      expect(lines[49]).toContain('Log entry 50');
    });

    it('should handle colored text in scroll buffer', () => {
      // Write colored lines exceeding terminal height
      for (let i = 1; i <= 30; i++) {
        const color = i % 2 === 0 ? '31' : '32'; // Alternate red/green
        tty.write(`\x1b[${color}mLine ${i}\x1b[0m\n`);
      }

      const fullOutput = tty.getFullOutput();
      expect(fullOutput).toContain('\x1b[31m');
      expect(fullOutput).toContain('\x1b[32m');

      const lines = tty.getLines();
      expect(lines.length).toBe(30);
    });

    it('should handle clearScreenDown with scroll buffer', () => {
      // Write many lines
      for (let i = 1; i <= 40; i++) {
        tty.write(`Line ${i}\n`);
      }

      // Move to line 20 (0-indexed as 19) and clear down
      tty.cursorTo(0, 19);
      tty.clearScreenDown();

      const lines = tty.getLines();
      // Should have lines 1-19, line 20 is cleared (cursor is at line 19, clears from cursor down)
      expect(lines.length).toBeLessThanOrEqual(20);
      // Line 19 should exist, but line 20 and beyond should be cleared
      expect(lines.some(line => line.includes('Line 19'))).toBe(true);
      expect(lines.some(line => line.includes('Line 21'))).toBe(false);
    });
  });

  describe('edge cases', () => {
    it('should handle empty writes', () => {
      tty.write('');
      const output = tty.getCleanOutput();
      expect(output).toBe('');
    });

    it('should handle writes with only ANSI codes', () => {
      tty.write('\x1b[31m\x1b[0m');
      const cleanOutput = tty.getCleanOutput();
      expect(cleanOutput).toBe('');
    });

    it('should handle malformed ANSI codes gracefully', () => {
      tty.write('\x1b[Hello');
      // Should not crash
      expect(tty.output.length).toBeGreaterThan(0);
    });

    it('should handle very long lines', () => {
      const longLine = 'A'.repeat(200);
      tty.write(longLine);
      const output = tty.getCleanOutput();
      expect(output).toBe(longLine);
    });

    it('should handle unicode characters', () => {
      tty.write('Hello 世界 🌍');
      const output = tty.getCleanOutput();
      expect(output).toBe('Hello 世界 🌍');
    });

    it('should handle tabs', () => {
      tty.write('Hello\tWorld');
      const output = tty.getCleanOutput();
      expect(output).toContain('Hello\tWorld');
    });
  });
});
