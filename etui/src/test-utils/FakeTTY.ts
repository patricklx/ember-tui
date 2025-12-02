/**
 * Fake TTY implementation for testing terminal output
 * Simulates actual terminal behavior with a 2D character buffer
 */
export class FakeTTY {
  public output: string[] = [];
  public rows: number = 24;
  public columns: number = 80;
  public isTTY: boolean = true;
  private cursorX: number = 0;
  private cursorY: number = 0;
  private lastClearIndex: number = 0;

  // Terminal buffer: array of lines, each line is array of {char, ansi}
  private buffer: Array<Array<{char: string, ansi: string}>> = [];
  private currentAnsiState: string = '';

  constructor() {
    this.initBuffer();
  }

  private initBuffer(): void {
    this.buffer = [];
    for (let i = 0; i < this.rows; i++) {
      this.buffer[i] = [];
    }
  }

  write(data: string): boolean {
    this.output.push(data);

    // Parse and apply the data to buffer
    let i = 0;
    while (i < data.length) {
      // Check for ANSI escape sequences
      if (data[i] === '\x1b' && data[i + 1] === '[') {
        const ansiEnd = this.findAnsiEnd(data, i + 2);
        if (ansiEnd !== -1) {
          const ansiCode = data.slice(i, ansiEnd + 1);
          this.handleAnsiCode(ansiCode);
          i = ansiEnd + 1;
          continue;
        }
      }

      // Handle newline
      if (data[i] === '\n') {
        this.cursorY++;
        this.cursorX = 0;
        // Ensure buffer has enough rows
        while (this.buffer.length <= this.cursorY) {
          this.buffer.push([]);
        }
        i++;
        continue;
      }

      // Handle carriage return
      if (data[i] === '\r') {
        this.cursorX = 0;
        i++;
        continue;
      }

      // Regular character - write to buffer
      this.writeCharToBuffer(data[i]);
      i++;
    }

    return true;
  }

  private findAnsiEnd(data: string, start: number): number {
    for (let i = start; i < data.length; i++) {
      const char = data[i];
      if ((char >= 'A' && char <= 'Z') || (char >= 'a' && char <= 'z')) {
        return i;
      }
    }
    return -1;
  }

  private handleAnsiCode(code: string): void {
    // Parse ANSI escape codes
    if (code === '\x1b[?25l') {
      // Hide cursor - ignore
      return;
    }
    if (code === '\x1b[?25h') {
      // Show cursor - ignore
      return;
    }

    // Cursor positioning: ESC[row;colH or ESC[row;colf
    const posMatch = code.match(/\x1b\[(\d+);(\d+)[Hf]/);
    if (posMatch) {
      this.cursorY = parseInt(posMatch[1]) - 1;
      this.cursorX = parseInt(posMatch[2]) - 1;
      return;
    }

    // Cursor to column: ESC[colG
    const colMatch = code.match(/\x1b\[(\d+)G/);
    if (colMatch) {
      this.cursorX = parseInt(colMatch[1]) - 1;
      return;
    }

    // Cursor movement
    const upMatch = code.match(/\x1b\[(\d+)A/);
    if (upMatch) {
      this.cursorY -= parseInt(upMatch[1]);
      return;
    }

    const downMatch = code.match(/\x1b\[(\d+)B/);
    if (downMatch) {
      this.cursorY += parseInt(downMatch[1]);
      return;
    }

    const rightMatch = code.match(/\x1b\[(\d+)C/);
    if (rightMatch) {
      this.cursorX += parseInt(rightMatch[1]);
      return;
    }

    const leftMatch = code.match(/\x1b\[(\d+)D/);
    if (leftMatch) {
      this.cursorX -= parseInt(leftMatch[1]);
      return;
    }

    // Clear line: ESC[0K (to end), ESC[1K (to start), ESC[2K (entire)
    if (code === '\x1b[0K') {
      this.clearLineFromCursorToEnd();
      return;
    }
    if (code === '\x1b[1K') {
      this.clearLineFromStartToCursor();
      return;
    }
    if (code === '\x1b[2K') {
      this.clearEntireLineInBuffer();
      return;
    }

    // Clear screen: ESC[2J, ESC[3J, ESC[0J
    if (code === '\x1b[2J' || code === '\x1b[3J') {
      this.initBuffer();
      this.cursorX = 0;
      this.cursorY = 0;
      return;
    }
    if (code === '\x1b[0J') {
      // Clear from cursor to end of screen
      this.clearLineFromCursorToEnd();
      for (let i = this.cursorY + 1; i < this.buffer.length; i++) {
        this.buffer[i] = [];
      }
      return;
    }

    // Color codes - track current state
    if (code.match(/\x1b\[\d+(;\d+)*m/)) {
      if (code === '\x1b[0m') {
        this.currentAnsiState = '';
      } else {
        this.currentAnsiState = code;
      }
      return;
    }
  }

  private writeCharToBuffer(char: string): void {
    // Ensure buffer has enough rows
    while (this.buffer.length <= this.cursorY) {
      this.buffer.push([]);
    }

    // Ensure current line has enough columns
    const line = this.buffer[this.cursorY];
    while (line.length <= this.cursorX) {
      line.push({char: ' ', ansi: ''});
    }

    // Write character with current ANSI state
      line[this.cursorX] = {char, ansi: this.currentAnsiState};
    this.cursorX++;
  }

  private clearLineFromCursorToEnd(): void {
    if (this.cursorY < this.buffer.length) {
      const line = this.buffer[this.cursorY];
      line.splice(this.cursorX);
    }
  }

  private clearLineFromStartToCursor(): void {
    if (this.cursorY < this.buffer.length) {
      const line = this.buffer[this.cursorY];
      for (let i = 0; i <= this.cursorX && i < line.length; i++) {
        line[i] = {char: ' ', ansi: ''};
      }
    }
  }

  private clearEntireLineInBuffer(): void {
    if (this.cursorY < this.buffer.length) {
      this.buffer[this.cursorY] = [];
    }
  }

  /**
   * Move cursor to absolute position
   */
  cursorTo(x: number, y?: number, callback?: () => void): boolean {
    this.cursorX = x;
    if (y !== undefined) {
      this.cursorY = y;
      this.output.push(`\x1b[${y + 1};${x + 1}H`);
    } else {
      this.output.push(`\x1b[${x + 1}G`);
    }
    if (callback) callback();
    return true;
  }

  /**
   * Move cursor relative to current position
   */
  moveCursor(dx: number, dy: number, callback?: () => void): boolean {
    this.cursorX += dx;
    this.cursorY += dy;

    if (dy < 0) {
      this.output.push(`\x1b[${Math.abs(dy)}A`);
    } else if (dy > 0) {
      this.output.push(`\x1b[${dy}B`);
    }

    if (dx > 0) {
      this.output.push(`\x1b[${dx}C`);
    } else if (dx < 0) {
      this.output.push(`\x1b[${Math.abs(dx)}D`);
    }

    if (callback) callback();
    return true;
  }

  /**
   * Clear line
   */
  clearLine(dir: -1 | 0 | 1, callback?: () => void): boolean {
    if (dir === -1) {
      this.output.push('\x1b[1K');
      this.clearLineFromStartToCursor();
    } else if (dir === 1) {
      this.output.push('\x1b[0K');
      this.clearLineFromCursorToEnd();
    } else {
      this.output.push('\x1b[2K');
      this.clearEntireLineInBuffer();
    }
    if (callback) callback();
    return true;
  }

  /**
   * Clear screen from cursor down
   */
  clearScreenDown(callback?: () => void): boolean {
    this.output.push('\x1b[0J');
    this.clearLineFromCursorToEnd();
    for (let i = this.cursorY + 1; i < this.buffer.length; i++) {
      this.buffer[i] = [];
    }
    if (callback) callback();
    return true;
  }

  /**
   * Get the actual rendered output from the buffer
   */
  private getBufferOutput(): string {
    const lines: string[] = [];

    for (let y = 0; y < this.buffer.length; y++) {
      const line = this.buffer[y];

      // Always add a line, even if empty, to preserve line indexing
      if (line.length === 0) {
        lines.push('');
        continue;
      }

      let lineStr = '';
      let lastAnsi = '';

      for (let x = 0; x < line.length; x++) {
        const cell = line[x];
        // Add ANSI code if it changed
        if (cell.ansi !== lastAnsi) {
          if (lastAnsi && !cell.ansi) {
            lineStr += '\x1b[0m'; // Reset if going from colored to non-colored
          }
          lineStr += cell.ansi;
          lastAnsi = cell.ansi;
        }
        lineStr += cell.char;
      }

      // Reset at end of line if we had any ANSI
      if (lastAnsi) {
        lineStr += '\x1b[0m';
      }

      lines.push(lineStr);
    }

    // Trim trailing empty lines (but keep internal empty lines for proper indexing)
    while (lines.length > 0 && lines[lines.length - 1] === '') {
      lines.pop();
    }

    return lines.join('\n');
  }

  /**
   * Get full output including all ANSI codes (for color code tests)
   */
  getFullOutput(): string {
    return this.getBufferOutput();
  }

  /**
   * Clear the output buffer marker (but keep terminal buffer state)
   */
  clear(): void {
    this.lastClearIndex = this.output.length;
    // Don't clear the buffer - it represents the persistent terminal state
  }

  /**
   * Get output since last clear() call
   */
  private getOutputSinceClear(): string {
    return this.output.slice(this.lastClearIndex).join('');
  }

  /**
   * Get output without ANSI cursor control codes
   */
  getVisibleOutput(): string {
    return this.getOutputSinceClear()
      .replace(/\x1b\[\?25[lh]/g, '')
      .replace(/\x1b\[\d+;\d+H/g, '')
      .replace(/\x1b\[\d+H/g, '')
      .replace(/\x1b\[\d+G/g, '')
      .replace(/\x1b\[\d+[ABCD]/g, '')
      .replace(/\x1b\[2J/g, '')
      .replace(/\x1b\[3J/g, '')
      .replace(/\x1b\[0J/g, '')
      .replace(/\x1b\[0K/g, '')
      .replace(/\x1b\[1K/g, '')
      .replace(/\x1b\[2K/g, '');
  }

  /**
   * Get the actual rendered output (what the terminal would show)
   * This is what tests should use to verify output
   */
  getCleanOutput(): string {
    const bufferOutput = this.getBufferOutput();
    // Remove ANSI color codes for clean comparison
    return bufferOutput.replace(/\x1b\[[0-9;]*m/g, '');
  }

  /**
   * Get lines from buffer
   */
  getLines(): string[] {
    const output = this.getCleanOutput();
    return output.split('\n').filter(line => line.length > 0);
  }

  /**
   * Reset the TTY state completely
   */
  reset(): void {
    this.output = [];
    this.lastClearIndex = 0;
    this.rows = 24;
    this.columns = 80;
    this.cursorX = 0;
    this.cursorY = 0;
    this.currentAnsiState = '';
    this.initBuffer();
  }
}
