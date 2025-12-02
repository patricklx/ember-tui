import "./globalSetup";
// @ts-expect-error - ember-vitest has no type declarations
import { setupRenderingContext } from 'ember-vitest';
import { describe, test, expect as hardExpect, beforeEach } from "vitest";
import { Text, render } from "ember-tui";
import { rerender } from "@ember/test-helpers";
import { trackedObject } from "@ember/reactive/collections";
import { FakeTTY } from "ember-tui/test-utils/FakeTTY";

const expect = hardExpect.soft;


describe("example", () => {
	test("it works", async () => {
		await using ctx = await setupRenderingContext();
		const state = trackedObject({ value: "hello there" });

		await ctx.render(<template><Text @backgroundColor="green">{{state.value}}</Text></template>);

		expect(ctx.element.textContent).toContain("hello there");
		render(ctx.element);
		state.value = "hello world";
		await rerender();
		expect(ctx.element.textContent).toContain("hello world");
	});
});

describe("background color clearing", () => {
	let fakeTTY: FakeTTY;

	beforeEach(() => {
		fakeTTY = new FakeTTY();
		fakeTTY.rows = 1000; // Use large rows to avoid scroll buffer logic
		fakeTTY.columns = 80;
	});

	test("should reset ANSI codes when changing background colors", async () => {
		await using ctx = await setupRenderingContext();
		const state = trackedObject({ backgroundColor: "red", text: "Red Background" });

		await ctx.render(<template><Text @backgroundColor={{state.backgroundColor}}>{{state.text}}</Text></template>);
		render(ctx.element, { stdout: fakeTTY as any });

		// Clear and force a second render with different content
		fakeTTY.clear();

		// Change to green background
		state.backgroundColor = "green";
		state.text = "Green Background";
		await rerender();
		render(ctx.element, { stdout: fakeTTY as any });

		// Verify the output contains the new text
		const cleanOutput = fakeTTY.getCleanOutput();
		expect(cleanOutput).toContain("Green Background");

		// Verify ANSI reset code was written (check raw output)
		const rawOutput = fakeTTY.output.join('');
		expect(rawOutput).toContain('\x1b[0m'); // ANSI reset code
	});

	test("should clear line from start when new text is prefixed with spaces", async () => {
		await using ctx = await setupRenderingContext();
		const state = trackedObject({ text: "Green Text" });

		await ctx.render(<template><Text @color="green">{{state.text}}</Text></template>);
		render(ctx.element, { stdout: fakeTTY as any });

		fakeTTY.clear();

		// Change to completely different text (triggers segment at position 0)
		state.text = "   Plain Text";
		await rerender();
		render(ctx.element, { stdout: fakeTTY as any });

		const cleanOutput = fakeTTY.getCleanOutput();
		// The test validates that the line was updated and old content cleared
		expect(cleanOutput).toContain("Plain Text");
		expect(cleanOutput).not.toContain("Green");
	});

	test("should clear line from cursor when new text is shorter", async () => {
		await using ctx = await setupRenderingContext();
		const state = trackedObject({ text: "Long text with blue background" });

		await ctx.render(<template><Text @backgroundColor="blue">{{state.text}}</Text></template>);
		render(ctx.element, { stdout: fakeTTY as any });

		fakeTTY.clear();

		// Change to much shorter text (triggers clearLineFromCursor for last segment)
		state.text = "Short";
		await rerender();
		render(ctx.element, { stdout: fakeTTY as any });

		// Verify the shorter text is rendered correctly
		const cleanOutput = fakeTTY.getCleanOutput();
		expect(cleanOutput).toContain("Short");
		expect(cleanOutput).not.toContain("Long text with blue background");
	});

	test("should clear entire line when text becomes empty", async () => {
		await using ctx = await setupRenderingContext();
		const state = trackedObject({ text: "Some text here" });

		await ctx.render(<template><Text>{{state.text}}</Text></template>);
		render(ctx.element, { stdout: fakeTTY as any });

		fakeTTY.clear();

		// Change to empty text (triggers clearEntireLine in updateLineMinimal)
		state.text = "";
		await rerender();
		render(ctx.element, { stdout: fakeTTY as any });

		// Verify the line is cleared (no text remains)
		const cleanOutput = fakeTTY.getCleanOutput();
		expect(cleanOutput).not.toContain("Some text here");
		// Empty text should result in empty or minimal output
		expect(cleanOutput.trim()).toBe("");
	});

	test("should handle background color removal", async () => {
		await using ctx = await setupRenderingContext();
		const state = trackedObject({ backgroundColor: "red", text: "Text with background" });

		await ctx.render(<template><Text @backgroundColor={{state.backgroundColor}}>{{state.text}}</Text></template>);
		render(ctx.element, { stdout: fakeTTY as any });

		fakeTTY.clear();

		// Remove background
		// @ts-expect-error - undefined is valid for backgroundColor
		state.backgroundColor = undefined;
		state.text = "Text without background";
		await rerender();
		render(ctx.element, { stdout: fakeTTY as any });

		// Verify the new text is rendered
		const cleanOutput = fakeTTY.getCleanOutput();
		expect(cleanOutput).toContain("Text without background");

		// Verify ANSI reset code was written to clear old background (check raw output)
		const rawOutput = fakeTTY.output.join('');
		expect(rawOutput).toContain('\x1b[0m'); // ANSI reset code
	});

	test("should handle multiple color changes in sequence", async () => {
		await using ctx = await setupRenderingContext();
		const state = trackedObject({ color: "red", text: "Red" });

		await ctx.render(<template><Text @color={{state.color}}>{{state.text}}</Text></template>);
		render(ctx.element, { stdout: fakeTTY as any });

		fakeTTY.clear();

		// Second render
		state.color = "green";
		state.text = "Green";
		await rerender();
		render(ctx.element, { stdout: fakeTTY as any });

		fakeTTY.clear();

		// Third render
		state.color = "blue";
		state.text = "Blue";
		await rerender();
		render(ctx.element, { stdout: fakeTTY as any });

		// Verify the final text is rendered
		const cleanOutput = fakeTTY.getCleanOutput();
		expect(cleanOutput).toContain("Blue");

		// Verify ANSI reset code was written in the last render (check raw output)
		const rawOutput = fakeTTY.output.join('');
		expect(rawOutput).toContain('\x1b[0m'); // ANSI reset code
	});
});
