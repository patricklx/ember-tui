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

	describe("combined features", () => {
		let fakeTTY: FakeTTY;

		beforeEach(() => {
			fakeTTY = new FakeTTY();
			fakeTTY.rows = 1000;
			fakeTTY.columns = 80;
		});

		test("should render box with border, background color, and positioning", async () => {
			await using ctx = await setupRenderingContext(App);
			
			await ctx.render(<template>
				<Box 
					@borderStyle="round" 
					@borderColor="cyan"
					@backgroundColor="black"
					@position="absolute"
					@top={{2}}
					@left={{5}}
				>
					<Text @color="green">Full Featured Box</Text>
				</Box>
			</template>);

			render(ctx.element, { stdout: fakeTTY as any });
			const cleanOutput = fakeTTY.getCleanOutput();
			const rawOutput = fakeTTY.output.join('');

			expect(cleanOutput).toContain("Full Featured Box");
			expect(cleanOutput).toMatch(/[╭╮╰╯│─]/); // Round border
			expect(rawOutput).toMatch(/\x1b\[40m/); // Black background
			expect(rawOutput).toMatch(/\x1b\[36m/); // Cyan border
			expect(rawOutput).toMatch(/\x1b\[32m/); // Green text
		});

		test("should handle complex nested boxes with different styles", async () => {
			await using ctx = await setupRenderingContext(App);
			
			await ctx.render(<template>
				<Box @borderStyle="double" @borderColor="magenta" @padding={{1}}>
					<Box @backgroundColor="yellow">
						<Text @color="black" @bold={{true}}>Nested Content</Text>
					</Box>
				</Box>
			</template>);

			render(ctx.element, { stdout: fakeTTY as any });
			const cleanOutput = fakeTTY.getCleanOutput();

			expect(cleanOutput).toContain("Nested Content");
			expect(cleanOutput).toMatch(/[╔╗╚╝║═]/); // Double border on outer box
		});

		test("should dynamically update multiple properties", async () => {
			await using ctx = await setupRenderingContext(App);
			const state = trackedObject({ 
				borderStyle: "single" as any,
				borderColor: "red",
				bgColor: "blue"
			});

			await ctx.render(<template>
				<Box 
					@borderStyle={{state.borderStyle}} 
					@borderColor={{state.borderColor}}
					@backgroundColor={{state.bgColor}}
				>
					<Text>Dynamic Multi-prop Box</Text>
				</Box>
			</template>);

			render(ctx.element, { stdout: fakeTTY as any });
			let rawOutput = fakeTTY.output.join('');
			expect(rawOutput).toMatch(/\x1b\[31m/); // Red border
			expect(rawOutput).toMatch(/\x1b\[44m/); // Blue background

			fakeTTY.clear();
			state.borderStyle = "double" as const;
			state.borderColor = "green";
			state.bgColor = "yellow";
			await rerender();
			render(ctx.element, { stdout: fakeTTY as any });

			rawOutput = fakeTTY.output.join('');
			const cleanOutput = fakeTTY.getCleanOutput();
			expect(cleanOutput).toMatch(/[╔╗╚╝║═]/); // Double border
			expect(rawOutput).toMatch(/\x1b\[32m/); // Green border
			expect(rawOutput).toMatch(/\x1b\[43m/); // Yellow background
		});
	});
});
