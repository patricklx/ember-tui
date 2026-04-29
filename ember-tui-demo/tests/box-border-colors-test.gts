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

	describe("border colors", () => {
		let fakeTTY: FakeTTY;

		beforeEach(() => {
			fakeTTY = new FakeTTY();
			fakeTTY.rows = 1000;
			fakeTTY.columns = 80;
		});

		test("should render box with colored border", async () => {
			await using ctx = await setupRenderingContext(App);
			
			await ctx.render(<template>
				<Box @borderStyle="single" @borderColor="red">
					<Text>Red Border</Text>
				</Box>
			</template>);

			render(ctx.element, { stdout: fakeTTY as any });
			const rawOutput = fakeTTY.output.join('');

			expect(rawOutput).toContain("Red Border");
			// Check for ANSI red color code (31)
			expect(rawOutput).toMatch(/\x1b\[31m/);
		});

		test("should render box with different border colors on each side", async () => {
			await using ctx = await setupRenderingContext(App);
			
			await ctx.render(<template>
				<Box 
					@borderStyle="single" 
					@borderTopColor="red"
					@borderBottomColor="blue"
					@borderLeftColor="green"
					@borderRightColor="yellow"
				>
					<Text>Multi-colored borders</Text>
				</Box>
			</template>);

			render(ctx.element, { stdout: fakeTTY as any });
			const rawOutput = fakeTTY.output.join('');

			expect(rawOutput).toContain("Multi-colored borders");
			// Check for ANSI color codes
			expect(rawOutput).toMatch(/\x1b\[3[1-7]m/);
		});

		test("should change border color dynamically", async () => {
			await using ctx = await setupRenderingContext(App);
			const state = trackedObject({ borderColor: "red" });

			await ctx.render(<template>
				<Box @borderStyle="single" @borderColor={{state.borderColor}}>
					<Text>Dynamic Color</Text>
				</Box>
			</template>);

			render(ctx.element, { stdout: fakeTTY as any });
			let rawOutput = fakeTTY.output.join('');
			expect(rawOutput).toMatch(/\x1b\[31m/); // Red

			fakeTTY.clear();
			state.borderColor = "green";
			await rerender();
			render(ctx.element, { stdout: fakeTTY as any });

			rawOutput = fakeTTY.output.join('');
			expect(rawOutput).toMatch(/\x1b\[32m/); // Green
		});

		test("should render box with dim border color", async () => {
			await using ctx = await setupRenderingContext(App);
			
			await ctx.render(<template>
				<Box @borderStyle="single" @borderColor="cyan" @borderDimColor={{true}}>
					<Text>Dim Border</Text>
				</Box>
			</template>);

			render(ctx.element, { stdout: fakeTTY as any });
			const rawOutput = fakeTTY.output.join('');

			expect(rawOutput).toContain("Dim Border");
			// Check for ANSI dim code (2)
			expect(rawOutput).toMatch(/\x1b\[2m/);
		});
	});
});
