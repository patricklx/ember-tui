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

	describe("positioning", () => {
		let fakeTTY: FakeTTY;

		beforeEach(() => {
			fakeTTY = new FakeTTY();
			fakeTTY.rows = 1000;
			fakeTTY.columns = 80;
		});

		test("should render box with absolute positioning", async () => {
			await using ctx = await setupRenderingContext(App);
			
			await ctx.render(<template>
				<Box @position="absolute" @top={{0}} @left={{0}}>
					<Text>Absolute Position</Text>
				</Box>
			</template>);

			render(ctx.element, { stdout: fakeTTY as any });
			const cleanOutput = fakeTTY.getCleanOutput();

			expect(cleanOutput).toContain("Absolute Position");
		});

		test("should render box with relative positioning", async () => {
			await using ctx = await setupRenderingContext(App);
			
			await ctx.render(<template>
				<Box @position="relative" @top={{2}} @left={{5}}>
					<Text>Relative Position</Text>
				</Box>
			</template>);

			render(ctx.element, { stdout: fakeTTY as any });
			const cleanOutput = fakeTTY.getCleanOutput();

			expect(cleanOutput).toContain("Relative Position");
		});

		test("should position box with top and left coordinates", async () => {
			await using ctx = await setupRenderingContext(App);
			
			await ctx.render(<template>
				<Box @position="absolute" @top={{5}} @left={{10}}>
					<Text>Positioned Content</Text>
				</Box>
			</template>);

			render(ctx.element, { stdout: fakeTTY as any });
			const cleanOutput = fakeTTY.getCleanOutput();

			expect(cleanOutput).toContain("Positioned Content");
		});

		test("should change position dynamically", async () => {
			await using ctx = await setupRenderingContext(App);
			const state = trackedObject({ top: 0, left: 0 });

			await ctx.render(<template>
				<Box @position="absolute" @top={{state.top}} @left={{state.left}}>
					<Text>Moving Box</Text>
				</Box>
			</template>);

			render(ctx.element, { stdout: fakeTTY as any });
			let cleanOutput = fakeTTY.getCleanOutput();
			expect(cleanOutput).toContain("Moving Box");

			fakeTTY.clear();
			state.top = 3;
			state.left = 5;
			await rerender();
			render(ctx.element, { stdout: fakeTTY as any });

			cleanOutput = fakeTTY.getCleanOutput();
			expect(cleanOutput).toContain("Moving Box");
		});

		test("should render nested boxes with positioning", async () => {
			await using ctx = await setupRenderingContext(App);
			
			await ctx.render(<template>
				<Box @position="relative">
					<Box @position="absolute" @top={{1}} @left={{2}}>
						<Text>Nested Positioned</Text>
					</Box>
				</Box>
			</template>);

			render(ctx.element, { stdout: fakeTTY as any });
			const cleanOutput = fakeTTY.getCleanOutput();

			expect(cleanOutput).toContain("Nested Positioned");
		});
	});
});
