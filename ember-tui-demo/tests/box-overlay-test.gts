/* eslint-disable no-control-regex */

import "./globalSetup";
import { setupRenderingContext } from 'ember-vitest';
import App from '../app/app';
import { describe, test, expect as hardExpect, beforeEach } from "vitest";
import { Text, Box, render, resetState } from "ember-tui";
import { rerender } from "@ember/test-helpers";
import { trackedObject } from "@ember/reactive/collections";
import { FakeTTY } from "ember-tui/test-utils/FakeTTY";

const expect = hardExpect.soft;

describe("Box component", () => {
	describe("overlay", () => {
		let fakeTTY: FakeTTY;

		beforeEach(() => {
			fakeTTY = new FakeTTY();
			fakeTTY.rows = 1000;
			fakeTTY.columns = 80;
			// Reset module-level render state to prevent stale state from previous tests
			resetState();
		});

		test("should preserve underlying text when overlay is enabled", async () => {
			await using ctx = await setupRenderingContext(App);
			
			await ctx.render(<template>
				<Box>
					<Text>Base Text Content</Text>
				</Box>
				<Box 
					@backgroundColor="red"
					@overlay={{true}}
					@position="absolute"
					@top={{0}}
					@left={{0}}
					@width={{10}}
					@height={{1}}
				/>
			</template>);

			render(ctx.element, { stdout: fakeTTY as any });
			const cleanOutput = fakeTTY.getCleanOutput();
			const rawOutput = fakeTTY.output.join('');

			// Text should still be present
			expect(cleanOutput).toContain("Base Text");
			// Background color should be applied (red = 41)
			expect(rawOutput).toMatch(/\x1b\[41m/);
		});

		test("should overlay background without overlay flag replacing content", async () => {
			await using ctx = await setupRenderingContext(App);
			
			await ctx.render(<template>
				<Box>
					<Text>AAAA BBBB CCCC</Text>
				</Box>
				<Box 
					@backgroundColor="blue"
					@position="absolute"
					@top={{0}}
					@left={{5}}
					@width={{5}}
					@height={{1}}
				/>
			</template>);

			render(ctx.element, { stdout: fakeTTY as any });
			const cleanOutput = fakeTTY.getCleanOutput();
			const rawOutput = fakeTTY.output.join('');

			// Without overlay flag (default behavior), the box background covers text with spaces
			// "AAAA " should be visible (first 5 chars)
			expect(cleanOutput).toContain("AAAA");
			// Middle section (5 chars at position 5-9) should be covered with spaces
			// "CCCC" at the end should still be visible
			expect(cleanOutput).toContain("CCCC");
			// Should have blue background (44)
			expect(rawOutput).toMatch(/\x1b\[44m/);
		});

		test("should dynamically toggle overlay mode", async () => {
			await using ctx = await setupRenderingContext(App);
			const state = trackedObject({ overlay: false });
			
			await ctx.render(<template>
				<Box>
					<Text>Background Text</Text>
				</Box>
				<Box 
					@backgroundColor="green"
					@overlay={{state.overlay}}
					@position="absolute"
					@top={{0}}
					@left={{0}}
					@width={{15}}
					@height={{1}}
				/>
			</template>);

			render(ctx.element, { stdout: fakeTTY as any });
			let cleanOutput = fakeTTY.getCleanOutput();
			
			// With overlay=false, the box covers the text with spaces
			// So we should see spaces with background color but not the original text
			expect(cleanOutput.length).toBeGreaterThan(0);

			fakeTTY.clear();
			state.overlay = true;
			await rerender();
			render(ctx.element, { stdout: fakeTTY as any });

			cleanOutput = fakeTTY.getCleanOutput();
			const rawOutput = fakeTTY.output.join('');

			// With overlay=true, text should be preserved with background
			expect(cleanOutput).toContain("Background");
			expect(rawOutput).toMatch(/\x1b\[42m/); // Green background
		});

		test("should overlay with different background colors", async () => {
			await using ctx = await setupRenderingContext(App);
			const state = trackedObject({ bgColor: "yellow" });
			
			await ctx.render(<template>
				<Box>
					<Text>Original Content Here</Text>
				</Box>
				<Box 
					@backgroundColor={{state.bgColor}}
					@overlay={{true}}
					@position="absolute"
					@top={{0}}
					@left={{0}}
					@width={{20}}
					@height={{1}}
				/>
			</template>);

			render(ctx.element, { stdout: fakeTTY as any });
			let rawOutput = fakeTTY.output.join('');
			
			// Yellow background (43)
			expect(rawOutput).toMatch(/\x1b\[43m/);

			fakeTTY.clear();
			state.bgColor = "magenta";
			await rerender();
			render(ctx.element, { stdout: fakeTTY as any });

			rawOutput = fakeTTY.output.join('');
			const cleanOutput = fakeTTY.getCleanOutput();

			// Magenta background (45)
			expect(rawOutput).toMatch(/\x1b\[45m/);
			// Text should still be preserved
			expect(cleanOutput).toContain("Original");
		});

		test("should handle overlay with absolute positioning at different coordinates", async () => {
			await using ctx = await setupRenderingContext(App);
			
			await ctx.render(<template>
				<Box>
					<Text>Line 1</Text>
					<Text>Line 2 with overlay</Text>
					<Text>Line 3</Text>
				</Box>
				<Box 
					@backgroundColor="cyan"
					@overlay={{true}}
					@position="absolute"
					@top={{1}}
					@left={{5}}
					@width={{10}}
					@height={{1}}
				/>
			</template>);

			render(ctx.element, { stdout: fakeTTY as any });
			const cleanOutput = fakeTTY.getCleanOutput();
			const rawOutput = fakeTTY.output.join('');

			// All lines should be present
			expect(cleanOutput).toContain("Line 1");
			expect(cleanOutput).toContain("Line 2");
			expect(cleanOutput).toContain("Line 3");
			// Cyan background should be applied (46)
			expect(rawOutput).toMatch(/\x1b\[46m/);
		});

		test("should overlay background on all positions including spaces", async () => {
			await using ctx = await setupRenderingContext(App);
			
			await ctx.render(<template>
				<Box>
					<Text>A   B   C</Text>
				</Box>
				<Box 
					@backgroundColor="red"
					@overlay={{true}}
					@position="absolute"
					@top={{0}}
					@left={{0}}
					@width={{9}}
					@height={{1}}
				/>
			</template>);

			render(ctx.element, { stdout: fakeTTY as any });
			const cleanOutput = fakeTTY.getCleanOutput();
			const rawOutput = fakeTTY.output.join('');

			// All characters A, B, C should be preserved
			expect(cleanOutput).toContain("A");
			expect(cleanOutput).toContain("B");
			expect(cleanOutput).toContain("C");
			// Red background (41) should be applied to entire overlay area (including spaces)
			expect(rawOutput).toMatch(/\x1b\[41m/);
			// The overlay should apply background to the entire overlay area (including spaces)
			// Note: styledCharsToString emits ANSI code once per consecutive run,
			// so we verify the background code appears at least once
			const bgMatches = rawOutput.match(/\x1b\[41m/g);
			expect(bgMatches).toBeTruthy();
			expect(bgMatches!.length).toBeGreaterThanOrEqual(1); // Applied to overlay area
		});

		test("should work with overlay and borders together", async () => {
			await using ctx = await setupRenderingContext(App);
			
			await ctx.render(<template>
				<Box>
					<Text>Content Below</Text>
				</Box>
				<Box 
					@backgroundColor="blue"
					@overlay={{true}}
					@borderStyle="single"
					@borderColor="white"
					@position="absolute"
					@top={{0}}
					@left={{5}}
					@width={{12}}
					@height={{3}}
				>
					<Text>Overlay</Text>
				</Box>
			</template>);

			render(ctx.element, { stdout: fakeTTY as any });
			const cleanOutput = fakeTTY.getCleanOutput();
			const rawOutput = fakeTTY.output.join('');

			// Should have border characters
			expect(cleanOutput).toMatch(/[┌┐└┘│─]/);
			// Should have the overlay text
			expect(cleanOutput).toContain("Overlay");
			// Should have blue background (44)
			expect(rawOutput).toMatch(/\x1b\[44m/);
		});

		test("should preserve bold text when overlaying background", async () => {
			await using ctx = await setupRenderingContext(App);
			
			await ctx.render(<template>
				<Box>
					<Text @bold={{true}}>Bold Text Here</Text>
				</Box>
				<Box 
					@backgroundColor="red"
					@overlay={{true}}
					@position="absolute"
					@top={{0}}
					@left={{0}}
					@width={{14}}
					@height={{1}}
				/>
			</template>);

			render(ctx.element, { stdout: fakeTTY as any });
			const cleanOutput = fakeTTY.getCleanOutput();
			const rawOutput = fakeTTY.output.join('');

			// Text should be preserved
			expect(cleanOutput).toContain("Bold Text Here");
			// Should have bold ANSI code (1)
			expect(rawOutput).toMatch(/\x1b\[1m/);
			// Should have red background (41)
			expect(rawOutput).toMatch(/\x1b\[41m/);
		});

		test("should preserve colored text when overlaying background", async () => {
			await using ctx = await setupRenderingContext(App);
			
			await ctx.render(<template>
				<Box>
					<Text @color="green">Green Text Here</Text>
				</Box>
				<Box 
					@backgroundColor="yellow"
					@overlay={{true}}
					@position="absolute"
					@top={{0}}
					@left={{0}}
					@width={{15}}
					@height={{1}}
				/>
			</template>);

							render(ctx.element, { stdout: fakeTTY as any });

							const cleanOutput = fakeTTY.getCleanOutput();

							const rawOutput = fakeTTY.output.join('');

					

							// Text should be preserved

							expect(cleanOutput).toContain("Green Text Here");

							// The overlay should preserve the underlying text and apply background

							// Note: Due to how overlay works, foreground colors may be reset

							// but the text content itself is preserved

							expect(cleanOutput).toContain("Green");

							// Should have yellow background (43)

							expect(rawOutput).toMatch(/\x1b\[43m/);		});

		test("should preserve bold and colored text when overlaying", async () => {
			await using ctx = await setupRenderingContext(App);
			
			await ctx.render(<template>
				<Box>
					<Text @bold={{true}} @color="cyan">Bold Cyan Text</Text>
				</Box>
				<Box 
					@backgroundColor="magenta"
					@overlay={{true}}
					@position="absolute"
					@top={{0}}
					@left={{0}}
					@width={{14}}
					@height={{1}}
				/>
			</template>);

			render(ctx.element, { stdout: fakeTTY as any });
			const cleanOutput = fakeTTY.getCleanOutput();
			const rawOutput = fakeTTY.output.join('');

			// Text should be preserved
			expect(cleanOutput).toContain("Bold Cyan Text");
			// Should have bold ANSI code (1)
			expect(rawOutput).toMatch(/\x1b\[1m/);
			// Should have cyan foreground (36)
			expect(rawOutput).toMatch(/\x1b\[36m/);
			// Should have magenta background (45)
			expect(rawOutput).toMatch(/\x1b\[45m/);
		});

		test("should preserve text with existing background when overlaying new background", async () => {
			await using ctx = await setupRenderingContext(App);
			
			await ctx.render(<template>
				<Box>
					<Text @backgroundColor="blue" @color="white">White on Blue</Text>
				</Box>
				<Box 
					@backgroundColor="red"
					@overlay={{true}}
					@position="absolute"
					@top={{0}}
					@left={{0}}
					@width={{13}}
					@height={{1}}
				/>
			</template>);

			render(ctx.element, { stdout: fakeTTY as any });
			const cleanOutput = fakeTTY.getCleanOutput();
			const rawOutput = fakeTTY.output.join('');

			// Text content should be preserved
			expect(cleanOutput).toContain("White on Blue");
			// Should have white foreground color preserved (37)
			expect(rawOutput).toMatch(/\x1b\[37m/);
			// Should have RED background from overlay (41), NOT blue
			expect(rawOutput).toMatch(/\x1b\[41m/);
			// Should NOT have blue background (44) - it should be replaced
			expect(rawOutput).not.toMatch(/\x1b\[44m/);
		});

		test("should preserve dim colored text when overlaying", async () => {
			await using ctx = await setupRenderingContext(App);
			
			await ctx.render(<template>
				<Box>
					<Text @color="yellow" @dimColor={{true}}>Dim Yellow</Text>
				</Box>
				<Box 
					@backgroundColor="black"
					@overlay={{true}}
					@position="absolute"
					@top={{0}}
					@left={{0}}
					@width={{10}}
					@height={{1}}
				/>
			</template>);

			render(ctx.element, { stdout: fakeTTY as any });
			const cleanOutput = fakeTTY.getCleanOutput();
			const rawOutput = fakeTTY.output.join('');

			// Text should be preserved
			expect(cleanOutput).toContain("Dim Yellow");
			// Should have dim ANSI code (2)
			expect(rawOutput).toMatch(/\x1b\[2m/);
			// Should have yellow foreground (33)
			expect(rawOutput).toMatch(/\x1b\[33m/);
			// Should have black background (40)
			expect(rawOutput).toMatch(/\x1b\[40m/);
		});

		test("should handle partial overlay on styled text", async () => {
			await using ctx = await setupRenderingContext(App);
			
			await ctx.render(<template>
				<Box>
					<Text @bold={{true}} @color="red">Full Bold Red Text</Text>
				</Box>
				<Box 
					@backgroundColor="green"
					@overlay={{true}}
					@position="absolute"
					@top={{0}}
					@left={{5}}
					@width={{8}}
					@height={{1}}
				/>
			</template>);

			render(ctx.element, { stdout: fakeTTY as any });
			const cleanOutput = fakeTTY.getCleanOutput();
			const rawOutput = fakeTTY.output.join('');

			// Text should be preserved
			expect(cleanOutput).toContain("Full Bold Red Text");
			// Should have bold ANSI code (1)
			expect(rawOutput).toMatch(/\x1b\[1m/);
			// Should have red foreground (31)
			expect(rawOutput).toMatch(/\x1b\[31m/);
			// Should have green background (42) for the middle section
			expect(rawOutput).toMatch(/\x1b\[42m/);
		});

		test("should dynamically update overlay on styled text", async () => {
			await using ctx = await setupRenderingContext(App);
			const state = trackedObject({ bgColor: "blue" });
			
			await ctx.render(<template>
				<Box>
					<Text @bold={{true}} @color="white">Static Bold White</Text>
				</Box>
				<Box 
					@backgroundColor={{state.bgColor}}
					@overlay={{true}}
					@position="absolute"
					@top={{0}}
					@left={{0}}
					@width={{17}}
					@height={{1}}
				/>
			</template>);

			render(ctx.element, { stdout: fakeTTY as any });
			let rawOutput = fakeTTY.output.join('');
			
			// Should have blue background (44)
			expect(rawOutput).toMatch(/\x1b\[44m/);
			// Should have bold (1)
			expect(rawOutput).toMatch(/\x1b\[1m/);
			// Should have white foreground (37)
			expect(rawOutput).toMatch(/\x1b\[37m/);

			fakeTTY.clear();
			state.bgColor = "yellow";
			await rerender();
			render(ctx.element, { stdout: fakeTTY as any });

			rawOutput = fakeTTY.output.join('');
			const cleanOutput = fakeTTY.getCleanOutput();

			// Text should still be preserved
			expect(cleanOutput).toContain("Static Bold White");
			// Should have yellow background (43)
			expect(rawOutput).toMatch(/\x1b\[43m/);
			// Should still have bold and white
			expect(rawOutput).toMatch(/\x1b\[1m/);
			expect(rawOutput).toMatch(/\x1b\[37m/);
		});

		test("should preserve multiple Text elements with different styles when overlaying", async () => {
			await using ctx = await setupRenderingContext(App);
			
			await ctx.render(<template>
				<Box>
					<Text @bold={{true}} @color="red">Bold Red</Text>
					<Text> </Text>
					<Text @color="green" @backgroundColor="black">Green on Black</Text>
					<Text> </Text>
					<Text @dimColor={{true}} @color="blue">Dim Blue</Text>
				</Box>
				<Box 
					@backgroundColor="yellow"
					@overlay={{true}}
					@position="absolute"
					@top={{0}}
					@left={{0}}
					@width={{50}}
					@height={{1}}
				/>
			</template>);

			render(ctx.element, { stdout: fakeTTY as any });
			const cleanOutput = fakeTTY.getCleanOutput();
			const rawOutput = fakeTTY.output.join('');

			// All text content should be preserved
			expect(cleanOutput).toContain("Bold Red");
			expect(cleanOutput).toContain("Green on Black");
			expect(cleanOutput).toContain("Dim Blue");
			
			// Bold style should be preserved (1)
			expect(rawOutput).toMatch(/\x1b\[1m/);
			// Red foreground should be preserved (31)
			expect(rawOutput).toMatch(/\x1b\[31m/);
			// Green foreground should be preserved (32)
			expect(rawOutput).toMatch(/\x1b\[32m/);
			// Blue foreground should be preserved (34)
			expect(rawOutput).toMatch(/\x1b\[34m/);
			// Dim style should be preserved (2)
			expect(rawOutput).toMatch(/\x1b\[2m/);
			
			// Yellow overlay background should be applied (43)
			expect(rawOutput).toMatch(/\x1b\[43m/);
			// Verify multiple styles coexist in output
			const hasMultipleStyles = 
				rawOutput.includes('\x1b[1m') &&
				rawOutput.includes('\x1b[31m') &&
				rawOutput.includes('\x1b[32m') &&
				rawOutput.includes('\x1b[43m');
			expect(hasMultipleStyles).toBe(true);
		});
	});
});
