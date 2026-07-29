import "./globalSetup";
import { setupRenderingContext } from 'ember-vitest';
import App from '../app/app';
import { describe, test, expect as hardExpect, beforeEach } from "vitest";
import { Text, Box, render } from "ember-tui";
import { rerender } from "@ember/test-helpers";
import { trackedObject } from "@ember/reactive/collections";
import { FakeTTY } from "ember-tui/test-utils/FakeTTY";

const expect = hardExpect.soft;

// Regression coverage for Box forwarding its bundled `@args` (width,
// flexDirection, alignItems, paddingX, flexGrow, overflow, ...) to Yoga.
// Box used to bind those args as a single `__attrs__={{this.attrs}}` template
// attribute, which only reaches Yoga correctly if Glimmer's dynamic-attribute
// VM ends up using the exact `SimpleDynamicAttribute` class instance ember-tui
// patches - something a host app's bundler isn't guaranteed to dedupe to.
// Box now applies its args via a modifier that calls ElementNode#setAttribute
// directly, sidestepping that VM path entirely.
describe("Box component args -> Yoga layout", () => {
	let fakeTTY: FakeTTY;

	beforeEach(() => {
		fakeTTY = new FakeTTY();
		fakeTTY.rows = 1000;
		fakeTTY.columns = 80;
	});

	test('@flexDirection="row" lays children out on one line, not the column default', async () => {
		await using ctx = await setupRenderingContext(App);

		await ctx.render(<template>
			<Box @flexDirection="row">
				<Text>Left</Text>
				<Text>Right</Text>
			</Box>
		</template>);

		render(ctx.element, { stdout: fakeTTY as any });
		const lines = fakeTTY.getCleanOutput().split("\n").filter((line) => line.trim().length > 0);

		expect(lines).toHaveLength(1);
		expect(lines[0]).toContain("Left");
		expect(lines[0]).toContain("Right");
	});

	test('@width + @alignItems="center" centers content within the given width', async () => {
		await using ctx = await setupRenderingContext(App);

		await ctx.render(<template>
			<Box @width={{20}} @alignItems="center">
				<Text>Hi</Text>
			</Box>
		</template>);

		render(ctx.element, { stdout: fakeTTY as any });
		const lines = fakeTTY.getCleanOutput().split("\n").filter((line) => line.includes("Hi"));

		expect(lines).toHaveLength(1);
		const line = lines[0]!;
		const leftPad = line.length - line.trimStart().length;
		// A 20-wide box centering a 2-char child leaves (20 - 2) / 2 = 9
		// leading columns of blank space before the text.
		expect(leftPad).toBe(9);
	});

	test('@overflow="hidden" clips content wider than @width', async () => {
		await using ctx = await setupRenderingContext(App);

		await ctx.render(<template>
			<Box @width={{5}} @overflow="hidden">
				<Text>This text is much longer than the box</Text>
			</Box>
		</template>);

		render(ctx.element, { stdout: fakeTTY as any });
		const cleanOutput = fakeTTY.getCleanOutput();

		expect(cleanOutput).not.toContain("much longer than the box");
	});

	test("dynamically updating @flexGrow re-applies through Yoga", async () => {
		await using ctx = await setupRenderingContext(App);
		const state = trackedObject({ grow: 0 });

		await ctx.render(<template>
			<Box @width={{20}} @flexDirection="row">
				<Box @flexGrow={{state.grow}}>
					<Text>A</Text>
				</Box>
				<Box>
					<Text>B</Text>
				</Box>
			</Box>
		</template>);

		render(ctx.element, { stdout: fakeTTY as any });
		let lines = fakeTTY.getCleanOutput().split("\n").filter((line) => line.trim().length > 0);
		const narrowGap = lines[0]!.indexOf("B") - lines[0]!.indexOf("A");

		fakeTTY.clear();
		state.grow = 1;
		await rerender();
		render(ctx.element, { stdout: fakeTTY as any });

		lines = fakeTTY.getCleanOutput().split("\n").filter((line) => line.trim().length > 0);
		const widerGap = lines[0]!.indexOf("B") - lines[0]!.indexOf("A");

		expect(widerGap).toBeGreaterThan(narrowGap);
	});
});
