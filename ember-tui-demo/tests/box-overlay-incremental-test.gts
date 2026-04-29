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

describe("Box overlay - incremental rendering", () => {
	let fakeTTY: FakeTTY;

	beforeEach(() => {
		fakeTTY = new FakeTTY();
		fakeTTY.rows = 1000;
		fakeTTY.columns = 80;
	});

	test("should add overlay after initial render with single text element", async () => {
		await using ctx = await setupRenderingContext(App);
		const state = trackedObject({ showOverlay: false });
		
		await ctx.render(<template>
			<Box>
				<Text>Base Content Here</Text>
			</Box>
			{{#if state.showOverlay}}
				<Box 
					@backgroundColor="red"
					@overlay={{true}}
					@position="absolute"
					@top={{0}}
					@left={{0}}
					@width={{17}}
					@height={{1}}
				/>
			{{/if}}
		</template>);

		// Initial render without overlay
		render(ctx.element, { stdout: fakeTTY as any });
		let cleanOutput = fakeTTY.getCleanOutput();
		let rawOutput = fakeTTY.output.join('');
		
		expect(cleanOutput).toContain("Base Content Here");
		expect(rawOutput).not.toMatch(/\x1b\[41m/); // No red background yet

		// Add overlay incrementally
		fakeTTY.clear();
		state.showOverlay = true;
		await rerender();
		render(ctx.element, { stdout: fakeTTY as any });

		cleanOutput = fakeTTY.getCleanOutput();
		rawOutput = fakeTTY.output.join('');

		// Text should still be preserved
		expect(cleanOutput).toContain("Base Content Here");
		// Red background should now be applied
		expect(rawOutput).toMatch(/\x1b\[41m/);
	});

	test("should add overlay after initial render with multiple text elements", async () => {
		await using ctx = await setupRenderingContext(App);
		const state = trackedObject({ showOverlay: false });
		
		await ctx.render(<template>
			<Box>
				<Text @color="red">First Line</Text>
				<Text @color="green">Second Line</Text>
				<Text @color="blue">Third Line</Text>
			</Box>
			{{#if state.showOverlay}}
				<Box 
					@backgroundColor="yellow"
					@overlay={{true}}
					@position="absolute"
					@top={{1}}
					@left={{0}}
					@width={{20}}
					@height={{1}}
				/>
			{{/if}}
		</template>);

		// Initial render without overlay
		render(ctx.element, { stdout: fakeTTY as any });
		let cleanOutput = fakeTTY.getCleanOutput();
		let rawOutput = fakeTTY.output.join('');
		
		expect(cleanOutput).toContain("First Line");
		expect(cleanOutput).toContain("Second Line");
		expect(cleanOutput).toContain("Third Line");
		expect(rawOutput).not.toMatch(/\x1b\[43m/); // No yellow background yet

		// Add overlay incrementally on second line
		fakeTTY.clear();
		state.showOverlay = true;
		await rerender();
		render(ctx.element, { stdout: fakeTTY as any });

		cleanOutput = fakeTTY.getCleanOutput();
		rawOutput = fakeTTY.output.join('');

		// All text should still be preserved
		expect(cleanOutput).toContain("First Line");
		expect(cleanOutput).toContain("Second Line");
		expect(cleanOutput).toContain("Third Line");
		// Yellow background should now be applied
		expect(rawOutput).toMatch(/\x1b\[43m/);
		// Green color should be preserved on second line
		expect(rawOutput).toMatch(/\x1b\[32m/);
	});

	test("should add multiple overlays incrementally", async () => {
		await using ctx = await setupRenderingContext(App);
		const state = trackedObject({ 
			showOverlay1: false,
			showOverlay2: false 
		});
		
		await ctx.render(<template>
			<Box>
				<Text>Line One Content</Text>
				<Text>Line Two Content</Text>
				<Text>Line Three Content</Text>
			</Box>
			{{#if state.showOverlay1}}
				<Box 
					@backgroundColor="red"
					@overlay={{true}}
					@position="absolute"
					@top={{0}}
					@left={{0}}
					@width={{16}}
					@height={{1}}
				/>
			{{/if}}
			{{#if state.showOverlay2}}
				<Box 
					@backgroundColor="blue"
					@overlay={{true}}
					@position="absolute"
					@top={{2}}
					@left={{0}}
					@width={{18}}
					@height={{1}}
				/>
			{{/if}}
		</template>);

		// Initial render without overlays
		render(ctx.element, { stdout: fakeTTY as any });
		let cleanOutput = fakeTTY.getCleanOutput();
		let rawOutput = fakeTTY.output.join('');
		
		expect(cleanOutput).toContain("Line One Content");
		expect(cleanOutput).toContain("Line Two Content");
		expect(cleanOutput).toContain("Line Three Content");
		expect(rawOutput).not.toMatch(/\x1b\[41m/); // No red
		expect(rawOutput).not.toMatch(/\x1b\[44m/); // No blue

		// Add first overlay
		fakeTTY.clear();
		state.showOverlay1 = true;
		await rerender();
		render(ctx.element, { stdout: fakeTTY as any });

		cleanOutput = fakeTTY.getCleanOutput();
		rawOutput = fakeTTY.output.join('');

		expect(cleanOutput).toContain("Line One Content");
		expect(rawOutput).toMatch(/\x1b\[41m/); // Red background on line 1
		expect(rawOutput).not.toMatch(/\x1b\[44m/); // No blue yet

		// Add second overlay
		fakeTTY.clear();
		state.showOverlay2 = true;
		await rerender();
		render(ctx.element, { stdout: fakeTTY as any });

		cleanOutput = fakeTTY.getCleanOutput();
		rawOutput = fakeTTY.output.join('');

		// All text should be preserved
		expect(cleanOutput).toContain("Line One Content");
		expect(cleanOutput).toContain("Line Two Content");
		expect(cleanOutput).toContain("Line Three Content");
		// Both backgrounds should be present
		expect(rawOutput).toMatch(/\x1b\[41m/); // Red on line 1
		expect(rawOutput).toMatch(/\x1b\[44m/); // Blue on line 3
	});

	test("should add overlay with styled text elements incrementally", async () => {
		await using ctx = await setupRenderingContext(App);
		const state = trackedObject({ showOverlay: false });
		
		await ctx.render(<template>
			<Box>
				<Text @bold={{true}} @color="cyan">Bold Cyan Text</Text>
				<Text> </Text>
				<Text @dimColor={{true}} @color="yellow">Dim Yellow Text</Text>
				<Text> </Text>
				<Text @backgroundColor="black" @color="white">White on Black</Text>
			</Box>
			{{#if state.showOverlay}}
				<Box 
					@backgroundColor="magenta"
					@overlay={{true}}
					@position="absolute"
					@top={{0}}
					@left={{0}}
					@width={{50}}
					@height={{1}}
				/>
			{{/if}}
		</template>);

		// Initial render without overlay
		render(ctx.element, { stdout: fakeTTY as any });
		let cleanOutput = fakeTTY.getCleanOutput();
		let rawOutput = fakeTTY.output.join('');
		
		expect(cleanOutput).toContain("Bold Cyan Text");
		expect(cleanOutput).toContain("Dim Yellow Text");
		expect(cleanOutput).toContain("White on Black");
		expect(rawOutput).toMatch(/\x1b\[1m/); // Bold
		expect(rawOutput).toMatch(/\x1b\[36m/); // Cyan
		expect(rawOutput).toMatch(/\x1b\[2m/); // Dim
		expect(rawOutput).toMatch(/\x1b\[33m/); // Yellow
		expect(rawOutput).not.toMatch(/\x1b\[45m/); // No magenta yet

		// Add overlay incrementally
		fakeTTY.clear();
		state.showOverlay = true;
		await rerender();
		render(ctx.element, { stdout: fakeTTY as any });

		cleanOutput = fakeTTY.getCleanOutput();
		rawOutput = fakeTTY.output.join('');

		// All text should be preserved
		expect(cleanOutput).toContain("Bold Cyan Text");
		expect(cleanOutput).toContain("Dim Yellow Text");
		expect(cleanOutput).toContain("White on Black");
		
		// All original styles should be preserved
		expect(rawOutput).toMatch(/\x1b\[1m/); // Bold
		expect(rawOutput).toMatch(/\x1b\[36m/); // Cyan
		expect(rawOutput).toMatch(/\x1b\[2m/); // Dim
		expect(rawOutput).toMatch(/\x1b\[33m/); // Yellow
		expect(rawOutput).toMatch(/\x1b\[37m/); // White
		
		// Magenta overlay background should now be applied
		expect(rawOutput).toMatch(/\x1b\[45m/);
	});

	test("should remove overlay incrementally", async () => {
		await using ctx = await setupRenderingContext(App);
		const state = trackedObject({ showOverlay: true });
		
		await ctx.render(<template>
			<Box>
				<Text @color="green">Green Text Content</Text>
			</Box>
			{{#if state.showOverlay}}
				<Box 
					@backgroundColor="red"
					@overlay={{true}}
					@position="absolute"
					@top={{0}}
					@left={{0}}
					@width={{18}}
					@height={{1}}
				/>
			{{/if}}
		</template>);

		// Initial render with overlay
		render(ctx.element, { stdout: fakeTTY as any });
		let cleanOutput = fakeTTY.getCleanOutput();
		let rawOutput = fakeTTY.output.join('');
		
		expect(cleanOutput).toContain("Green Text Content");
		expect(rawOutput).toMatch(/\x1b\[32m/); // Green
		expect(rawOutput).toMatch(/\x1b\[41m/); // Red background

		// Remove overlay incrementally - create new FakeTTY for clean state
		const fakeTTY2 = new FakeTTY();
		fakeTTY2.rows = 1000;
		fakeTTY2.columns = 80;
		
		state.showOverlay = false;
		await rerender();
		render(ctx.element, { stdout: fakeTTY2 as any });

		cleanOutput = fakeTTY2.getCleanOutput();
		rawOutput = fakeTTY2.output.join('');

		// Text should still be present
		expect(cleanOutput).toContain("Green Text Content");
		// Green color should be preserved
		expect(rawOutput).toMatch(/\x1b\[32m/);
		// Red background should be gone
		expect(rawOutput).not.toMatch(/\x1b\[41m/);
	});

	test("should toggle overlay multiple times with multiple text elements", async () => {
		await using ctx = await setupRenderingContext(App);
		const state = trackedObject({ showOverlay: false });
		
		await ctx.render(<template>
			<Box>
				<Text @bold={{true}}>First Bold</Text>
				<Text @color="red">Second Red</Text>
				<Text @color="blue">Third Blue</Text>
			</Box>
			{{#if state.showOverlay}}
				<Box 
					@backgroundColor="yellow"
					@overlay={{true}}
					@position="absolute"
					@top={{0}}
					@left={{0}}
					@width={{30}}
					@height={{3}}
				/>
			{{/if}}
		</template>);

		// Cycle 1: No overlay
		const tty1 = new FakeTTY();
		tty1.rows = 1000;
		tty1.columns = 80;
		render(ctx.element, { stdout: tty1 as any });
		let cleanOutput = tty1.getCleanOutput();
		let rawOutput = tty1.output.join('');
		
		expect(cleanOutput).toContain("First Bold");
		expect(cleanOutput).toContain("Second Red");
		expect(cleanOutput).toContain("Third Blue");
		expect(rawOutput).not.toMatch(/\x1b\[43m/);

		// Cycle 2: Add overlay
		const tty2 = new FakeTTY();
		tty2.rows = 1000;
		tty2.columns = 80;
		state.showOverlay = true;
		await rerender();
		render(ctx.element, { stdout: tty2 as any });

		cleanOutput = tty2.getCleanOutput();
		rawOutput = tty2.output.join('');

		expect(cleanOutput).toContain("First Bold");
		expect(cleanOutput).toContain("Second Red");
		expect(cleanOutput).toContain("Third Blue");
		expect(rawOutput).toMatch(/\x1b\[43m/); // Yellow background

		// Cycle 3: Remove overlay
		const tty3 = new FakeTTY();
		tty3.rows = 1000;
		tty3.columns = 80;
		state.showOverlay = false;
		await rerender();
		render(ctx.element, { stdout: tty3 as any });

		cleanOutput = tty3.getCleanOutput();
		rawOutput = tty3.output.join('');

		expect(cleanOutput).toContain("First Bold");
		expect(cleanOutput).toContain("Second Red");
		expect(cleanOutput).toContain("Third Blue");
		expect(rawOutput).not.toMatch(/\x1b\[43m/);

		// Cycle 4: Add overlay again
		const tty4 = new FakeTTY();
		tty4.rows = 1000;
		tty4.columns = 80;
		state.showOverlay = true;
		await rerender();
		render(ctx.element, { stdout: tty4 as any });

		cleanOutput = tty4.getCleanOutput();
		rawOutput = tty4.output.join('');

		expect(cleanOutput).toContain("First Bold");
		expect(cleanOutput).toContain("Second Red");
		expect(cleanOutput).toContain("Third Blue");
		expect(rawOutput).toMatch(/\x1b\[43m/); // Yellow background back
	});

	test("should add overlay with partial coverage on multiple text elements", async () => {
		await using ctx = await setupRenderingContext(App);
		const state = trackedObject({ showOverlay: false });
		
		await ctx.render(<template>
			<Box>
				<Text>AAAA BBBB CCCC DDDD</Text>
				<Text>EEEE FFFF GGGG HHHH</Text>
				<Text>IIII JJJJ KKKK LLLL</Text>
			</Box>
			{{#if state.showOverlay}}
				<Box 
					@backgroundColor="cyan"
					@overlay={{true}}
					@position="absolute"
					@top={{1}}
					@left={{5}}
					@width={{10}}
					@height={{1}}
				/>
			{{/if}}
		</template>);

		// Initial render without overlay
		render(ctx.element, { stdout: fakeTTY as any });
		let cleanOutput = fakeTTY.getCleanOutput();
		let rawOutput = fakeTTY.output.join('');
		
		expect(cleanOutput).toContain("AAAA BBBB CCCC DDDD");
		expect(cleanOutput).toContain("EEEE FFFF GGGG HHHH");
		expect(cleanOutput).toContain("IIII JJJJ KKKK LLLL");

		// Add overlay incrementally on middle line, partial coverage
		fakeTTY.clear();
		state.showOverlay = true;
		await rerender();
		render(ctx.element, { stdout: fakeTTY as any });

		cleanOutput = fakeTTY.getCleanOutput();
		rawOutput = fakeTTY.output.join('');

		// All text should be preserved
		expect(cleanOutput).toContain("AAAA BBBB CCCC DDDD");
		expect(cleanOutput).toContain("EEEE FFFF GGGG HHHH");
		expect(cleanOutput).toContain("IIII JJJJ KKKK LLLL");
		// Cyan background should be applied
		expect(rawOutput).toMatch(/\x1b\[46m/);
	});

	test("should add overlay with borders incrementally", async () => {
		await using ctx = await setupRenderingContext(App);
		const state = trackedObject({ showOverlay: false });
		
		await ctx.render(<template>
			<Box>
				<Text>Content Line 1</Text>
				<Text>Content Line 2</Text>
				<Text>Content Line 3</Text>
			</Box>
			{{#if state.showOverlay}}
				<Box 
					@backgroundColor="blue"
					@overlay={{true}}
					@borderStyle="single"
					@borderColor="white"
					@position="absolute"
					@top={{0}}
					@left={{5}}
					@width={{15}}
					@height={{5}}
				>
					<Text>Overlay</Text>
				</Box>
			{{/if}}
		</template>);

		// Initial render without overlay
		const tty1 = new FakeTTY();
		tty1.rows = 1000;
		tty1.columns = 80;
		render(ctx.element, { stdout: tty1 as any });
		let cleanOutput = tty1.getCleanOutput();
		let rawOutput = tty1.output.join('');
		
		expect(cleanOutput).toContain("Content Line 1");
		expect(cleanOutput).toContain("Content Line 2");
		expect(cleanOutput).toContain("Content Line 3");
		expect(cleanOutput).not.toMatch(/[┌┐└┘│─]/); // No borders yet
		expect(rawOutput).not.toMatch(/\x1b\[44m/); // No blue background

		// Add overlay with borders incrementally
		const tty2 = new FakeTTY();
		tty2.rows = 1000;
		tty2.columns = 80;
		state.showOverlay = true;
		await rerender();
		render(ctx.element, { stdout: tty2 as any });

		cleanOutput = tty2.getCleanOutput();
		rawOutput = tty2.output.join('');

		// Should have border characters
		expect(cleanOutput).toMatch(/[┌┐└┘│─]/);
		// Should have overlay text
		expect(cleanOutput).toContain("Overlay");
		// Should have blue background
		expect(rawOutput).toMatch(/\x1b\[44m/);
		// Note: With overlay=true and borders, the underlying text may be partially covered by the border box
		// This is expected behavior - overlay preserves text where there's no border/content
	});

	test("should add overlay and change its properties incrementally", async () => {
		await using ctx = await setupRenderingContext(App);
		const state = trackedObject({ 
			showOverlay: false,
			bgColor: "red"
		});
		
		await ctx.render(<template>
			<Box>
				<Text>Static Content Here</Text>
			</Box>
			{{#if state.showOverlay}}
				<Box 
					@backgroundColor={{state.bgColor}}
					@overlay={{true}}
					@position="absolute"
					@top={{0}}
					@left={{0}}
					@width={{19}}
					@height={{1}}
				/>
			{{/if}}
		</template>);

		// Initial render without overlay
		const tty1 = new FakeTTY();
		tty1.rows = 1000;
		tty1.columns = 80;
		render(ctx.element, { stdout: tty1 as any });
		let cleanOutput = tty1.getCleanOutput();
		
		expect(cleanOutput).toContain("Static Content Here");

		// Add overlay
		const tty2 = new FakeTTY();
		tty2.rows = 1000;
		tty2.columns = 80;
		state.showOverlay = true;
		await rerender();
		render(ctx.element, { stdout: tty2 as any });

		cleanOutput = tty2.getCleanOutput();
		let rawOutput = tty2.output.join('');

		expect(cleanOutput).toContain("Static Content Here");
		expect(rawOutput).toMatch(/\x1b\[41m/); // Red background

		// Change overlay color to green
		const tty3 = new FakeTTY();
		tty3.rows = 1000;
		tty3.columns = 80;
		state.bgColor = "green";
		await rerender();
		render(ctx.element, { stdout: tty3 as any });

		cleanOutput = tty3.getCleanOutput();
		rawOutput = tty3.output.join('');

		expect(cleanOutput).toContain("Static Content Here");
		expect(rawOutput).toMatch(/\x1b\[42m/); // Green background
		expect(rawOutput).not.toMatch(/\x1b\[41m/); // No red

		// Change overlay color to blue
		const tty4 = new FakeTTY();
		tty4.rows = 1000;
		tty4.columns = 80;
		state.bgColor = "blue";
		await rerender();
		render(ctx.element, { stdout: tty4 as any });

		cleanOutput = tty4.getCleanOutput();
		rawOutput = tty4.output.join('');

		expect(cleanOutput).toContain("Static Content Here");
		expect(rawOutput).toMatch(/\x1b\[44m/); // Blue background
		expect(rawOutput).not.toMatch(/\x1b\[42m/); // No green
		expect(rawOutput).not.toMatch(/\x1b\[41m/); // No red
	});

	test("should handle complex incremental scenario with multiple text elements and overlays", async () => {
		await using ctx = await setupRenderingContext(App);
		const state = trackedObject({ 
			overlay1: false,
			overlay2: false,
			overlay3: false
		});
		
		await ctx.render(<template>
			<Box>
				<Text @bold={{true}} @color="red">Line 1: Bold Red</Text>
				<Text @color="green">Line 2: Green</Text>
				<Text @color="blue">Line 3: Blue</Text>
				<Text @dimColor={{true}} @color="yellow">Line 4: Dim Yellow</Text>
				<Text @backgroundColor="black" @color="white">Line 5: White on Black</Text>
			</Box>
			{{#if state.overlay1}}
				<Box 
					@backgroundColor="cyan"
					@overlay={{true}}
					@position="absolute"
					@top={{0}}
					@left={{0}}
					@width={{20}}
					@height={{1}}
				/>
			{{/if}}
			{{#if state.overlay2}}
				<Box 
					@backgroundColor="magenta"
					@overlay={{true}}
					@position="absolute"
					@top={{2}}
					@left={{5}}
					@width={{15}}
					@height={{1}}
				/>
			{{/if}}
			{{#if state.overlay3}}
				<Box 
					@backgroundColor="yellow"
					@overlay={{true}}
					@position="absolute"
					@top={{4}}
					@left={{10}}
					@width={{25}}
					@height={{1}}
				/>
			{{/if}}
		</template>);

		// Step 1: Initial render without overlays
		render(ctx.element, { stdout: fakeTTY as any });
		let cleanOutput = fakeTTY.getCleanOutput();
		
		expect(cleanOutput).toContain("Line 1: Bold Red");
		expect(cleanOutput).toContain("Line 2: Green");
		expect(cleanOutput).toContain("Line 3: Blue");
		expect(cleanOutput).toContain("Line 4: Dim Yellow");
		expect(cleanOutput).toContain("Line 5: White on Black");

		// Step 2: Add first overlay on line 1
		fakeTTY.clear();
		state.overlay1 = true;
		await rerender();
		render(ctx.element, { stdout: fakeTTY as any });

		cleanOutput = fakeTTY.getCleanOutput();
		let rawOutput = fakeTTY.output.join('');

		expect(cleanOutput).toContain("Line 1: Bold Red");
		expect(rawOutput).toMatch(/\x1b\[1m/); // Bold preserved
		expect(rawOutput).toMatch(/\x1b\[31m/); // Red preserved
		expect(rawOutput).toMatch(/\x1b\[46m/); // Cyan background

		// Step 3: Add second overlay on line 3
		fakeTTY.clear();
		state.overlay2 = true;
		await rerender();
		render(ctx.element, { stdout: fakeTTY as any });

		cleanOutput = fakeTTY.getCleanOutput();
		rawOutput = fakeTTY.output.join('');

		expect(cleanOutput).toContain("Line 3: Blue");
		expect(rawOutput).toMatch(/\x1b\[34m/); // Blue preserved
		expect(rawOutput).toMatch(/\x1b\[45m/); // Magenta background

		// Step 4: Add third overlay on line 5
		fakeTTY.clear();
		state.overlay3 = true;
		await rerender();
		render(ctx.element, { stdout: fakeTTY as any });

		cleanOutput = fakeTTY.getCleanOutput();
		rawOutput = fakeTTY.output.join('');

		// All text should be preserved
		expect(cleanOutput).toContain("Line 1: Bold Red");
		expect(cleanOutput).toContain("Line 2: Green");
		expect(cleanOutput).toContain("Line 3: Blue");
		expect(cleanOutput).toContain("Line 4: Dim Yellow");
		expect(cleanOutput).toContain("Line 5: White on Black");

		// All overlays should be present
		expect(rawOutput).toMatch(/\x1b\[46m/); // Cyan
		expect(rawOutput).toMatch(/\x1b\[45m/); // Magenta
		expect(rawOutput).toMatch(/\x1b\[43m/); // Yellow

		// All original styles should be preserved
		expect(rawOutput).toMatch(/\x1b\[1m/); // Bold
		expect(rawOutput).toMatch(/\x1b\[31m/); // Red
		expect(rawOutput).toMatch(/\x1b\[32m/); // Green
		expect(rawOutput).toMatch(/\x1b\[34m/); // Blue
		expect(rawOutput).toMatch(/\x1b\[2m/); // Dim
		expect(rawOutput).toMatch(/\x1b\[33m/); // Yellow text
		expect(rawOutput).toMatch(/\x1b\[37m/); // White
	});
});
