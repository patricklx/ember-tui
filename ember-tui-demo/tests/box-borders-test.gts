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
		let fakeTTY: FakeTTY;

		beforeEach(() => {
			fakeTTY = new FakeTTY();
			fakeTTY.rows = 1000;
			fakeTTY.columns = 80;
			resetState();
		});

	describe("borders", () => {
		let fakeTTY: FakeTTY;

		beforeEach(() => {
			fakeTTY = new FakeTTY();
			fakeTTY.rows = 1000;
			fakeTTY.columns = 80;
			resetState();
		});

		test("should render box with single border style", async () => {
			await using ctx = await setupRenderingContext(App);
			
			await ctx.render(<template>
				<Box @borderStyle="single">
					<Text>Content</Text>
				</Box>
			</template>);

			render(ctx.element, { stdout: fakeTTY as any });
			const cleanOutput = fakeTTY.getCleanOutput();

			// Single border uses these characters: ┌─┐│└┘
			expect(cleanOutput).toContain("Content");
			// Check for border characters (corners and lines)
			expect(cleanOutput).toMatch(/[┌┐└┘│─]/);
		});

		test("should render box with double border style", async () => {
			await using ctx = await setupRenderingContext(App);
			
			await ctx.render(<template>
				<Box @borderStyle="double">
					<Text>Content</Text>
				</Box>
			</template>);

			render(ctx.element, { stdout: fakeTTY as any });
			const cleanOutput = fakeTTY.getCleanOutput();

			// Double border uses these characters: ╔═╗║╚╝
			expect(cleanOutput).toContain("Content");
			expect(cleanOutput).toMatch(/[╔╗╚╝║═]/);
		});

		test("should render box with round border style", async () => {
			await using ctx = await setupRenderingContext(App);
			
			await ctx.render(<template>
				<Box @borderStyle="round">
					<Text>Content</Text>
				</Box>
			</template>);

			render(ctx.element, { stdout: fakeTTY as any });
			const cleanOutput = fakeTTY.getCleanOutput();

			// Round border uses these characters: ╭─╮│╰╯
			expect(cleanOutput).toContain("Content");
			expect(cleanOutput).toMatch(/[╭╮╰╯│─]/);
		});

		test("should render box without specific borders", async () => {
			await using ctx = await setupRenderingContext(App);
			
			await ctx.render(<template>
				<Box @borderStyle="single" @borderTop={{false}} @borderBottom={{false}}>
					<Text>Only side borders</Text>
				</Box>
			</template>);

			render(ctx.element, { stdout: fakeTTY as any });
			const cleanOutput = fakeTTY.getCleanOutput();

			expect(cleanOutput).toContain("Only side borders");
		});

		test("should change border style dynamically", async () => {
			await using ctx = await setupRenderingContext(App);
			const state = trackedObject({ borderStyle: "single" as any });

			await ctx.render(<template>
				<Box @borderStyle={{state.borderStyle}}>
					<Text>Dynamic Border</Text>
				</Box>
			</template>);

			render(ctx.element, { stdout: fakeTTY as any });
			let cleanOutput = fakeTTY.getCleanOutput();
			expect(cleanOutput).toMatch(/[┌┐└┘│─]/);

			fakeTTY.clear();
			state.borderStyle = "double" as const;
			await rerender();
			render(ctx.element, { stdout: fakeTTY as any });

			cleanOutput = fakeTTY.getCleanOutput();
			expect(cleanOutput).toMatch(/[╔╗╚╝║═]/);
		});
	});
});
