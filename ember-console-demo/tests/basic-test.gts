import "./globalSetup";
import { setupRenderingContext } from 'ember-vitest';
import { describe, test, expect as hardExpect, vi, beforeEach, afterEach } from "vitest";
import { Text, render } from "ember-console";
import { rerender } from "@ember/test-helpers";
import { trackedObject } from "@ember/reactive/collections";
import * as applyTermUpdates from 'ember-console/render/helpers';
import { clearLineToStart } from "ember-console/render/helpers";

const expect = hardExpect.soft;


describe("example", () => {
	test("it works", async () => {
		await using ctx = await setupRenderingContext();
		const state = trackedObject({ value: "hello there" });

		await ctx.render(<template><Text @backgroundColor="green">{{state.value}}</Text></template>);

		expect(ctx.element.textContent).toContain("hello there");
		render(ctx.render);
		state.value = "hello world";
		await rerender();
		expect(ctx.element.textContent).toContain("hello world");
	});
});

describe("background color clearing", () => {
	let clearLineToStartSpy: any;
	let clearLineFromCursorSpy: any;
	let clearEntireLineSpy: any;
	let stdoutWriteSpy: any;
	let originalIsTTY: boolean | undefined;

	beforeEach(() => {
		// Mock TTY to enable terminal rendering mode
		originalIsTTY = process.stdout.isTTY;
		Object.defineProperty(process.stdout, 'isTTY', {
			value: true,
			writable: true,
			configurable: true
		});

		// Mock stdout dimensions - use large rows to avoid scroll buffer logic
		Object.defineProperty(process.stdout, 'rows', {
			value: 1000,
			writable: true,
			configurable: true
		});
		Object.defineProperty(process.stdout, 'columns', {
			value: 80,
			writable: true,
			configurable: true
		});

		clearLineToStartSpy = vi.spyOn(applyTermUpdates, 'clearLineToStart').mockImplementation(() => {});
		clearLineFromCursorSpy = vi.spyOn(applyTermUpdates, 'clearLineFromCursor').mockImplementation(() => {});
		clearEntireLineSpy = vi.spyOn(applyTermUpdates, 'clearEntireLine').mockImplementation(() => {});
		stdoutWriteSpy = vi.spyOn(process.stdout, 'write').mockReturnValue(true);
	});

	afterEach(() => {
		clearLineToStartSpy.mockRestore();
		clearLineFromCursorSpy.mockRestore();
		clearEntireLineSpy.mockRestore();
		stdoutWriteSpy.mockRestore();

		// Restore original TTY state
		Object.defineProperty(process.stdout, 'isTTY', {
			value: originalIsTTY,
			writable: true,
			configurable: true
		});
	});

	test("should reset ANSI codes when changing background colors", async () => {
		await using ctx = await setupRenderingContext();
		const state = trackedObject({ backgroundColor: "red", text: "Red Background" });
		const debugProcess = {
			stdout: {
				write: vi.fn()
			},

		}

		await ctx.render(<template><Text @backgroundColor={{state.backgroundColor}}>{{state.text}}</Text></template>);
		render(ctx.element);

		// Clear spies and force a second render with different content
		stdoutWriteSpy.mockClear();
		clearLineToStartSpy.mockClear();
		clearLineFromCursorSpy.mockClear();
		clearEntireLineSpy.mockClear();

		// Change to green background
		state.backgroundColor = "green";
		state.text = "Green Background";
		await rerender();
		render(ctx.element);

		// Verify stdout.write was called (render happened)
		expect(stdoutWriteSpy.mock.calls.length).toBeGreaterThan(0);

		// Verify ANSI reset code was written
		const writeCalls = stdoutWriteSpy.mock.calls.map(call => call[0]);
		expect(writeCalls.map(x => x.trim()).filter(Boolean)).toMatchInlineSnapshot(`
			[
			  "[2J[3J[H",
			  "Green Background",
			  "[?25h",
			]
		`);
	});

	test("should clear line from start when new text is prefixed with spaces", async () => {
		await using ctx = await setupRenderingContext();
		const state = trackedObject({ text: "Green Text" });

		await ctx.render(<template><Text @color="green">{{state.text}}</Text></template>);
		render(ctx.element);

		clearLineToStartSpy.mockClear();
		stdoutWriteSpy.mockClear();

		// Change to completely different text (triggers segment at position 0)
		state.text = "   Plain Text";
		await rerender();
		render(ctx.element);

		const writeCalls = stdoutWriteSpy.mock.calls.map(call => call[0]);
		expect(writeCalls.map(x => x.trim()).filter(Boolean)).toMatchInlineSnapshot(`
			[
			  "[2J[3J[H",
			  "Plain Text",
			  "[?25h",
			]
		`)
		expect(clearLineToStartSpy).toHaveBeenCalled();
	});

	test("should clear line from cursor when new text is shorter", async () => {
		await using ctx = await setupRenderingContext();
		const state = trackedObject({ text: "Long text with blue background" });

		await ctx.render(<template><Text @backgroundColor="blue">{{state.text}}</Text></template>);
		render(ctx.element);

		clearLineFromCursorSpy.mockClear();

		// Change to much shorter text (triggers clearLineFromCursor for last segment)
		state.text = "Short";
		await rerender();
		render(document.body);

		// Verify clearLineFromCursor was called when new text is shorter
		expect(clearLineFromCursorSpy).toHaveBeenCalled();
	});

	test("should clear entire line when text becomes empty", async () => {
		console.log('should clear entire line ')
		await using ctx = await setupRenderingContext();
		const state = trackedObject({ text: "Some text here" });

		await ctx.render(<template><Text>{{state.text}}</Text></template>);
		render(ctx.element);

		clearEntireLineSpy.mockClear();

		// Change to empty text (triggers clearEntireLine in updateLineMinimal)
		state.text = "";
		await rerender();
		render(ctx.element);

		// Verify clearEntireLine was called when text becomes empty
		expect(clearEntireLineSpy).toHaveBeenCalled();
	});

	test("should handle background color removal", async () => {
		await using ctx = await setupRenderingContext();
		const state = trackedObject({ backgroundColor: "red", text: "Text with background" });

		await ctx.render(<template><Text @backgroundColor={{state.backgroundColor}}>{{state.text}}</Text></template>);
		render(ctx.element);

		stdoutWriteSpy.mockClear();

		// Remove background
		state.backgroundColor = undefined;
		state.text = "Text without background";
		await rerender();
		render(ctx.element);

		// Verify ANSI reset code was written to clear old background
		const writeCalls = stdoutWriteSpy.mock.calls.map(call => call[0]);
		const hasResetCode = writeCalls.some(call =>
			typeof call === 'string' && call.includes('\x1b[0m')
		);
		expect(hasResetCode).toBe(true);
	});

	test("should handle multiple color changes in sequence", async () => {
		await using ctx = await setupRenderingContext();
		const state = trackedObject({ color: "red", text: "Red" });

		await ctx.render(<template><Text @color={{state.color}}>{{state.text}}</Text></template>);
		render(ctx.element);

		stdoutWriteSpy.mockClear();

		// Second render
		state.color = "green";
		state.text = "Green";
		await rerender();
		render(ctx.element);

		stdoutWriteSpy.mockClear();

		// Third render
		state.color = "blue";
		state.text = "Blue";
		await rerender();
		render(ctx.element);

		// Verify ANSI reset code was written in the last render
		const writeCalls = stdoutWriteSpy.mock.calls.map(call => call[0]);
		const hasResetCode = writeCalls.some(call =>
			typeof call === 'string' && call.includes('\x1b[0m')
		);
		expect(hasResetCode).toBe(true);
	});
});
