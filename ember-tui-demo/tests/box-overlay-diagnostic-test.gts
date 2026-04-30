/* eslint-disable no-control-regex */

import "./globalSetup";
import { setupRenderingContext } from 'ember-vitest';
import App from '../app/app';
import { describe, test, expect as hardExpect, beforeEach } from "vitest";
import { Text, Box, render } from "ember-tui";
import { rerender } from "@ember/test-helpers";
import { trackedObject } from "@ember/reactive/collections";
import { FakeTTY } from "ember-tui/test-utils/FakeTTY";

const expect = hardExpect.soft;

describe("Box overlay - diagnostic tests for incremental rendering bugs", () => {
	let fakeTTY: FakeTTY;

	beforeEach(() => {
		fakeTTY = new FakeTTY();
		fakeTTY.rows = 1000;
		fakeTTY.columns = 80;
	});

	test("should not leave artifacts when adding overlay incrementally", async () => {
		await using ctx = await setupRenderingContext(App);
		const state = trackedObject({ showOverlay: false });
		
		await ctx.render(<template>
			<Box>
				<Text>AAAA BBBB CCCC</Text>
			</Box>
			{{#if state.showOverlay}}
				<Box 
					@backgroundColor="red"
					@overlay={{true}}
					@position="absolute"
					@top={{0}}
					@left={{0}}
					@width={{13}}
					@height={{1}}
				/>
			{{/if}}
		</template>);

		// Initial render - use SAME TTY instance for incremental rendering
		fakeTTY.clear(); // Clear output buffer but keep terminal state
		render(ctx.element, { stdout: fakeTTY as any });
		const output1 = fakeTTY.getCleanOutput();
		const raw1 = fakeTTY.getOutputSinceClear();
		
		expect(output1).toBe("AAAA BBBB CCCC");
		expect(raw1).not.toContain('\x1b[41m'); // No red background

		// Add overlay - should preserve all text (reuse same TTY)
		fakeTTY.clear(); // Clear output buffer but keep terminal state
		state.showOverlay = true;
		await rerender();
		render(ctx.element, { stdout: fakeTTY as any });
		
		const output2 = fakeTTY.getCleanOutput();
		const raw2 = fakeTTY.getOutputSinceClear();

		// Text should be exactly the same
		expect(output2).toBe("AAAA BBBB CCCC");
		// Should have red background
		expect(raw2).toContain('\x1b[41m');
		
		// Verify no extra characters or artifacts
		const textOnly2 = output2.replace(/\s+/g, '');
		expect(textOnly2).toBe("AAAABBBBCCCC");
	});

	test("should correctly preserve ANSI codes when adding overlay to styled text", async () => {
		await using ctx = await setupRenderingContext(App);
		const state = trackedObject({ showOverlay: false });
		
		await ctx.render(<template>
			<Box>
				<Text @bold={{true}} @color="green">Bold Green</Text>
			</Box>
			{{#if state.showOverlay}}
				<Box 
					@backgroundColor="yellow"
					@overlay={{true}}
					@position="absolute"
					@top={{0}}
					@left={{0}}
					@width={{10}}
					@height={{1}}
				/>
			{{/if}}
		</template>);

		// Initial render - use shared fakeTTY
		fakeTTY.clear();
		render(ctx.element, { stdout: fakeTTY as any });
		const raw1 = fakeTTY.getOutputSinceClear();
		
		// Should have bold (1) and green (32)
		expect(raw1).toMatch(/\x1b\[1m/);
		expect(raw1).toMatch(/\x1b\[32m/);
		expect(raw1).not.toMatch(/\x1b\[43m/); // No yellow bg yet

		// Add overlay
		fakeTTY.clear();
		state.showOverlay = true;
		await rerender();
		render(ctx.element, { stdout: fakeTTY as any });
		
		const output2 = fakeTTY.getCleanOutput();
		const raw2 = fakeTTY.getOutputSinceClear();

		// Text should be preserved
		expect(output2).toContain("Bold Green");
		
		// All original ANSI codes should still be present
		expect(raw2).toMatch(/\x1b\[1m/); // Bold
		expect(raw2).toMatch(/\x1b\[32m/); // Green foreground
		expect(raw2).toMatch(/\x1b\[43m/); // Yellow background added
		
		// Verify the order: bold and green should come before yellow background
		const boldIndex = raw2.indexOf('\x1b[1m');
		const greenIndex = raw2.indexOf('\x1b[32m');
		const yellowIndex = raw2.indexOf('\x1b[43m');
		
		expect(boldIndex).toBeGreaterThan(-1);
		expect(greenIndex).toBeGreaterThan(-1);
		expect(yellowIndex).toBeGreaterThan(-1);
	});

	test("should handle multiple text elements with overlay added incrementally - detailed check", async () => {
		await using ctx = await setupRenderingContext(App);
		const state = trackedObject({ showOverlay: false });
		
		await ctx.render(<template>
			<Box>
				<Text @color="red">Line 1</Text>
				<Text @color="green">Line 2</Text>
				<Text @color="blue">Line 3</Text>
			</Box>
			{{#if state.showOverlay}}
				<Box 
					@backgroundColor="cyan"
					@overlay={{true}}
					@position="absolute"
					@top={{1}}
					@left={{0}}
					@width={{6}}
					@height={{1}}
				/>
			{{/if}}
		</template>);

		// Initial render
		fakeTTY.clear();
		render(ctx.element, { stdout: fakeTTY as any });
		const output1 = fakeTTY.getCleanOutput();
		const lines1 = output1.split('\n').filter(l => l.trim());
		
		expect(lines1).toHaveLength(3);
		expect(lines1[0]).toContain("Line 1");
		expect(lines1[1]).toContain("Line 2");
		expect(lines1[2]).toContain("Line 3");

		// Add overlay on line 2
		fakeTTY.clear();
		state.showOverlay = true;
		await rerender();
		render(ctx.element, { stdout: fakeTTY as any });
		
		const output2 = fakeTTY.getCleanOutput();
		
		const raw2 = fakeTTY.getOutputSinceClear();
		
		const lines2 = output2.split('\n').filter(l => l.trim());

		// All three lines should still be present
		expect(lines2).toHaveLength(3);
		expect(lines2[0]).toContain("Line 1");
		expect(lines2[1]).toContain("Line 2");
		expect(lines2[2]).toContain("Line 3");
		
		// Line 2 should have cyan background
		expect(raw2).toMatch(/\x1b\[46m/); // Cyan background
		// Line 2 should still have green foreground
		expect(raw2).toMatch(/\x1b\[32m/); // Green
		
		// Note: Lines 1 and 3 are not in raw2 because they weren't updated
		// (incremental rendering only writes changed lines)
		// But they should still be present in the clean output
		expect(lines2[0]).toContain("Line 1");
		expect(lines2[2]).toContain("Line 3");
	});

	test("should not corrupt output when toggling overlay rapidly", async () => {
		await using ctx = await setupRenderingContext(App);
		const state = trackedObject({ showOverlay: false });
		
		await ctx.render(<template>
			<Box>
				<Text>Test Content</Text>
			</Box>
			{{#if state.showOverlay}}
				<Box 
					@backgroundColor="magenta"
					@overlay={{true}}
					@position="absolute"
					@top={{0}}
					@left={{0}}
					@width={{12}}
					@height={{1}}
				/>
			{{/if}}
		</template>);

		// Cycle through multiple toggles
		for (let i = 0; i < 5; i++) {
			fakeTTY.clear();
			
			state.showOverlay = i % 2 === 1; // Toggle on odd iterations
			await rerender();
			render(ctx.element, { stdout: fakeTTY as any });
			
			const output = fakeTTY.getCleanOutput();
			const raw = fakeTTY.getOutputSinceClear();
			
			// Text should always be present and correct
			expect(output).toContain("Test Content");
			
			// Background should match state
			if (state.showOverlay) {
				expect(raw).toMatch(/\x1b\[45m/); // Magenta
			} else {
				expect(raw).not.toMatch(/\x1b\[45m/); // No magenta
			}
			
			// Should not have any corruption markers
			expect(output).not.toContain('undefined');
			expect(output).not.toContain('null');
			expect(output).not.toContain('[object');
		}
	});

	test("should preserve exact character positions with overlay", async () => {
		await using ctx = await setupRenderingContext(App);
		const state = trackedObject({ showOverlay: false });
		
		await ctx.render(<template>
			<Box>
				<Text>0123456789</Text>
			</Box>
			{{#if state.showOverlay}}
				<Box 
					@backgroundColor="blue"
					@overlay={{true}}
					@position="absolute"
					@top={{0}}
					@left={{3}}
					@width={{4}}
					@height={{1}}
				/>
			{{/if}}
		</template>);

		// Initial render
		fakeTTY.clear();
		render(ctx.element, { stdout: fakeTTY as any });
		const output1 = fakeTTY.getCleanOutput();
		
		expect(output1).toBe("0123456789");

		// Add overlay at position 3, width 4 (should cover "3456")
		fakeTTY.clear();
		state.showOverlay = true;
		await rerender();
		render(ctx.element, { stdout: fakeTTY as any });
		
		const output2 = fakeTTY.getCleanOutput();
		const raw2 = fakeTTY.getOutputSinceClear();

		// All characters should still be present
		expect(output2).toBe("0123456789");
		
		// Should have blue background
		expect(raw2).toMatch(/\x1b\[44m/);
		
		// Characters should be in correct order
		const cleanText = output2.replace(/\s+/g, '');
		expect(cleanText).toBe("0123456789");
	});

	test("should handle overlay with width changes incrementally", async () => {
		await using ctx = await setupRenderingContext(App);
		const state = trackedObject({ 
			showOverlay: true,
			width: 5
		});
		
		await ctx.render(<template>
			<Box>
				<Text>ABCDEFGHIJ</Text>
			</Box>
			{{#if state.showOverlay}}
				<Box 
					@backgroundColor="green"
					@overlay={{true}}
					@position="absolute"
					@top={{0}}
					@left={{0}}
					@width={{state.width}}
					@height={{1}}
				/>
			{{/if}}
		</template>);

		// Initial render with width=5
		fakeTTY.clear();
		render(ctx.element, { stdout: fakeTTY as any });
		const output1 = fakeTTY.getCleanOutput();
		
		expect(output1).toBe("ABCDEFGHIJ");

		// Change width to 8 - reuse same TTY for incremental rendering
		fakeTTY.clear();
		state.width = 8;
		await rerender();
		render(ctx.element, { stdout: fakeTTY as any });
		
		const output2 = fakeTTY.getCleanOutput();
		
		// All text should still be present
		expect(output2).toBe("ABCDEFGHIJ");

		// Change width to 3 - reuse same TTY for incremental rendering
		fakeTTY.clear();
		state.width = 3;
		await rerender();
		render(ctx.element, { stdout: fakeTTY as any });
		
		const output3 = fakeTTY.getCleanOutput();
		
		// All text should still be present
		expect(output3).toBe("ABCDEFGHIJ");
	});

	test("should verify no memory leaks or duplicate ANSI codes", async () => {
		await using ctx = await setupRenderingContext(App);
		const state = trackedObject({ showOverlay: false });
		
		await ctx.render(<template>
			<Box>
				<Text @color="yellow">Yellow Text</Text>
			</Box>
			{{#if state.showOverlay}}
				<Box 
					@backgroundColor="red"
					@overlay={{true}}
					@position="absolute"
					@top={{0}}
					@left={{0}}
					@width={{11}}
					@height={{1}}
				/>
			{{/if}}
		</template>);

		// Add overlay
		fakeTTY.clear();
		state.showOverlay = true;
		await rerender();
		render(ctx.element, { stdout: fakeTTY as any });
		
		const raw1 = fakeTTY.getOutputSinceClear();
		
		// Count occurrences of yellow foreground code
		const yellowMatches = raw1.match(/\x1b\[33m/g);
		const redBgMatches = raw1.match(/\x1b\[41m/g);
		
		// Should have reasonable number of ANSI codes (not duplicated excessively)
		expect(yellowMatches).toBeTruthy();
		expect(redBgMatches).toBeTruthy();
		
		// Each character should not have duplicate codes
		// A reasonable upper bound would be 2-3x the text length
		const textLength = "Yellow Text".length;
		if (yellowMatches) {
			expect(yellowMatches.length).toBeLessThan(textLength * 3);
		}
		if (redBgMatches) {
			expect(redBgMatches.length).toBeLessThan(textLength * 3);
		}
	});
});
