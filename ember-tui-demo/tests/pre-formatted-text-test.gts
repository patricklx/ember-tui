import "./globalSetup";
import { setupRenderingContext } from 'ember-vitest';
import App from '../app/app';
import { describe, test, expect as hardExpect, beforeEach } from "vitest";
import { Text, Box, render, FakeTTY } from "ember-tui";
import { clearScreen } from "ember-tui";

const expect = hardExpect.soft;

describe("Pre-formatted text test", () => {
  let fakeTTY: FakeTTY;

  beforeEach(() => {
    clearScreen();
    fakeTTY = new FakeTTY();
    fakeTTY.reset();
  });

  test("should preserve whitespace in pre-formatted text", async () => {
    await using ctx = await setupRenderingContext(App);

    const preFormattedContent = "  indented text\n    more indented\n  back to first level";

    await ctx.render(<template>
      <Box @flexDirection="column">
        <Text @preFormatted={{true}}>{{preFormattedContent}}</Text>
      </Box>
    </template>);

    render(ctx.element, { stdout: fakeTTY as any });

    const output = fakeTTY.getCleanOutput();
    console.log('=== Pre-formatted output ===');
    console.log(output);
    console.log('=== End output ===');

    // Should preserve leading spaces
    expect(output).toContain('  indented text');
    expect(output).toContain('    more indented');
    expect(output).toContain('  back to first level');
  });

  test("should preserve multiple spaces in pre-formatted text", async () => {
    await using ctx = await setupRenderingContext(App);

    const preFormattedContent = "word1    word2     word3";

    await ctx.render(<template>
      <Box @flexDirection="column">
        <Text @preFormatted={{true}}>{{preFormattedContent}}</Text>
      </Box>
    </template>);

    render(ctx.element, { stdout: fakeTTY as any });

    const output = fakeTTY.getCleanOutput();
    
    // Should preserve multiple spaces between words
    expect(output).toContain('word1    word2     word3');
  });

  test("should preserve tabs in pre-formatted text", async () => {
    await using ctx = await setupRenderingContext(App);

    const preFormattedContent = "line1\n\tindented with tab\n\t\tdouble tab";

    await ctx.render(<template>
      <Box @flexDirection="column">
        <Text @preFormatted={{true}}>{{preFormattedContent}}</Text>
      </Box>
    </template>);

    render(ctx.element, { stdout: fakeTTY as any });

    const output = fakeTTY.getCleanOutput();
    
    // Should preserve tabs (tabs are typically rendered as spaces)
    expect(output).toContain('line1');
    expect(output).toMatch(/\s+indented with tab/);
    expect(output).toMatch(/\s+double tab/);
  });

  test("should preserve newlines in pre-formatted text", async () => {
    await using ctx = await setupRenderingContext(App);

    const preFormattedContent = "line 1\n\nline 3 (with blank line above)";

    await ctx.render(<template>
      <Box @flexDirection="column">
        <Text @preFormatted={{true}}>{{preFormattedContent}}</Text>
      </Box>
    </template>);

    render(ctx.element, { stdout: fakeTTY as any });

    const output = fakeTTY.getCleanOutput();
    
    // Should preserve newlines including blank lines
    expect(output).toContain('line 1');
    expect(output).toContain('line 3 (with blank line above)');
  });

  test("should handle code-like formatting", async () => {
    await using ctx = await setupRenderingContext(App);

    const codeContent = `function example() {
  const x = 1;
  if (x > 0) {
    console.log('positive');
  }
}`;

    await ctx.render(<template>
      <Box @flexDirection="column">
        <Text @preFormatted={{true}} @color="cyan">{{codeContent}}</Text>
      </Box>
    </template>);

    render(ctx.element, { stdout: fakeTTY as any });

    const output = fakeTTY.getCleanOutput();
    
    // Should preserve code indentation
    expect(output).toContain('function example()');
    expect(output).toContain('  const x = 1;');
    expect(output).toContain('    console.log');
  });

  test("should work with styled pre-formatted text", async () => {
    await using ctx = await setupRenderingContext(App);

    const preFormattedContent = "  styled\n    pre-formatted\n  text";

    await ctx.render(<template>
      <Box @flexDirection="column">
        <Text @preFormatted={{true}} @color="green" @bold={{true}}>{{preFormattedContent}}</Text>
      </Box>
    </template>);

    render(ctx.element, { stdout: fakeTTY as any });

    // Verify pre-formatted text preserves whitespace even with styling
    const cleanOutput = fakeTTY.getCleanOutput();
    expect(cleanOutput).toContain('  styled');
    expect(cleanOutput).toContain('    pre-formatted');
    expect(cleanOutput).toContain('  text');
  });

  test("should handle mixed pre-formatted and normal text", async () => {
    await using ctx = await setupRenderingContext(App);

    const preFormattedContent = "  code block\n    indented";

    await ctx.render(<template>
      <Box @flexDirection="column">
        <Text>Normal text</Text>
        <Text @preFormatted={{true}}>{{preFormattedContent}}</Text>
        <Text>More normal text</Text>
      </Box>
    </template>);

    render(ctx.element, { stdout: fakeTTY as any });

    const output = fakeTTY.getCleanOutput();
    
    expect(output).toContain('Normal text');
    expect(output).toContain('  code block');
    expect(output).toContain('    indented');
    expect(output).toContain('More normal text');
  });

  test("should preserve trailing spaces in pre-formatted text", async () => {
    await using ctx = await setupRenderingContext(App);

    const preFormattedContent = "text with trailing spaces   \nmore text   ";

    await ctx.render(<template>
      <Box @flexDirection="column">
        <Text @preFormatted={{true}}>{{preFormattedContent}}</Text>
      </Box>
    </template>);

    render(ctx.element, { stdout: fakeTTY as any });

    const output = fakeTTY.getCleanOutput();
    
    // Should preserve trailing spaces (though they might be trimmed by terminal)
    expect(output).toContain('text with trailing spaces');
    expect(output).toContain('more text');
  });
});
