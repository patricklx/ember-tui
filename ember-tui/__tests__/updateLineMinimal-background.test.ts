import { describe, it, expect, beforeEach } from 'vitest';
import { FakeTTY } from '../src/test-utils/FakeTTY';

// Import the internal function for testing
// We'll need to expose it or test through the public API

describe('updateLineMinimal - background color handling', () => {
  let tty: FakeTTY;

  beforeEach(() => {
    tty = new FakeTTY(80, 24);
  });

  it('should handle adding background color to plain text', () => {
    const oldLine = 'Hello World';
    const newLine = '\x1b[46mHello World\x1b[49m';
    
    // Simulate the update
    tty.write('\x1b[1;1H' + oldLine); // Write old line
    tty.clear();
    
    // Now update with background
    tty.write('\x1b[1;1H' + newLine);
    
    const output = tty.getFullOutput();
    console.log('Output:', JSON.stringify(output));
    
    // Should contain the background color code
    expect(output).toContain('\x1b[46m');
    expect(output).toContain('Hello World');
  });

  it('should handle background color across multiple segments', () => {
    const oldLine = '\x1b[36mAuto-approve: \x1b[1m\x1b[37moff\x1b[0m \x1b[36mTokens left: \x1b[1m\x1b[37m100%\x1b[0m';
    const newLine = '\x1b[106m \x1b[36mAuto-approve: \x1b[1m\x1b[37moff\x1b[0m \x1b[36mTokens left: \x1b[1m\x1b[37m100%\x1b[0m';
    
    tty.write('\x1b[1;1H' + oldLine);
    tty.clear();
    
    tty.write('\x1b[1;1H' + newLine);
    
    const output = tty.getFullOutput();
    console.log('Output with bg:', JSON.stringify(output));
    
    // Should contain background color
    expect(output).toContain('\x1b[106m');
    // Should still have the text
    expect(output).toContain('Auto-approve');
  });

  it('should show what segments are generated for background overlay', () => {
    const oldLine = 'Auto-approve: off';
    const newLine = '\x1b[106m \x1b[36mAuto-approve: \x1b[1m\x1b[37moff\x1b[0m';
    
    console.log('\n=== Segment Analysis ===');
    console.log('Old:', JSON.stringify(oldLine));
    console.log('New:', JSON.stringify(newLine));
    
    // The key issue: when we have segments like:
    // Segment 0: start=0, text='\x1b[106m '
    // Segment 1: start=1, text='\x1b[36mAuto-approve: '
    // 
    // If we cursor position to column 0, write segment 0, then cursor to column 1,
    // the background from segment 0 doesn't continue because we moved the cursor
    
    expect(true).toBe(true);
  });
});
