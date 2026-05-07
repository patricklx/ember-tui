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

describe("Box component", () => {
		let fakeTTY: FakeTTY;

		beforeEach(() => {
			fakeTTY = new FakeTTY();
			fakeTTY.rows = 1000;
			fakeTTY.columns = 80;
		});

	describe("colors", () => {
		let fakeTTY: FakeTTY;

		beforeEach(() => {
			fakeTTY = new FakeTTY();
			fakeTTY.rows = 1000;
			fakeTTY.columns = 80;
		});

		test("should render box with background color", async () => {
			await using ctx = await setupRenderingContext(App);
			
			await ctx.render(<template>
				<Box @backgroundColor="blue">
					<Text>Blue Background</Text>
				</Box>
			</template>);

			render(ctx.element, { stdout: fakeTTY as any });
			const rawOutput = fakeTTY.output.join('');

			expect(rawOutput).toContain("Blue Background");
			// Check for ANSI background blue color code (44)
			expect(rawOutput).toMatch(/\x1b\[44m/);
		});

		test("should change background color dynamically", async () => {
			await using ctx = await setupRenderingContext(App);
			const state = trackedObject({ bgColor: "red" });

			await ctx.render(<template>
				<Box @backgroundColor={{state.bgColor}}>
					<Text>Dynamic Background</Text>
				</Box>
			</template>);

			render(ctx.element, { stdout: fakeTTY as any });
			let rawOutput = fakeTTY.output.join('');
			expect(rawOutput).toMatch(/\x1b\[41m/); // Red background

			fakeTTY.clear();
			state.bgColor = "green";
			await rerender();
			render(ctx.element, { stdout: fakeTTY as any });

			rawOutput = fakeTTY.output.join('');
			expect(rawOutput).toMatch(/\x1b\[42m/); // Green background
		});

		test("should handle removing background color", async () => {
			await using ctx = await setupRenderingContext(App);
			const state = trackedObject({ bgColor: "yellow" as string | undefined });

			await ctx.render(<template>
				<Box @backgroundColor={{state.bgColor}}>
					<Text>Background Toggle</Text>
				</Box>
			</template>);

			render(ctx.element, { stdout: fakeTTY as any });
			let rawOutput = fakeTTY.output.join('');
			expect(rawOutput).toMatch(/\x1b\[43m/); // Yellow background

			fakeTTY.clear();
			state.bgColor = undefined;
			await rerender();
			render(ctx.element, { stdout: fakeTTY as any });

			rawOutput = fakeTTY.output.join('');
			expect(rawOutput).toContain("Background Toggle");
			// Should have reset code
			expect(rawOutput).toContain('\x1b[0m');
		});

		test("should render box with background color and border", async () => {
			await using ctx = await setupRenderingContext(App);
			
			await ctx.render(<template>
				<Box @backgroundColor="blue" @borderStyle="single" @borderColor="red">
					<Text @color="white">Colored Box</Text>
				</Box>
			</template>);

			render(ctx.element, { stdout: fakeTTY as any });
			const rawOutput = fakeTTY.output.join('');

			expect(rawOutput).toContain("Colored Box");
			// Should have both background and border colors
			expect(rawOutput).toMatch(/\x1b\[44m/); // Blue background
			expect(rawOutput).toMatch(/\x1b\[31m/); // Red border
			expect(rawOutput).toMatch(/\x1b\[37m/); // White text
		});
	});
});
