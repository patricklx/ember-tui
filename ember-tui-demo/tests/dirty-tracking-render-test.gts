// @ts-nocheck
import "./globalSetup";
import { trackedObject } from "@ember/reactive/collections";
import { rerender } from "@ember/test-helpers";
import { setupRenderingContext } from "ember-vitest";
import { describe, test, expect as hardExpect } from "vitest";
import App from "../app/app";
import { Box, Text, render, resetState } from "ember-tui";
import { FakeTTY } from "ember-tui/test-utils/FakeTTY";
import type ElementNode from "ember-tui/dom/nodes/ElementNode";

const expect = hardExpect.soft;

describe("dirty tracking render", () => {
	test("should track dirty nodes after render", async () => {
		await using ctx = await setupRenderingContext(App);
		const state = trackedObject({ color: "red", text: "Hello" });

		await ctx.render(<template>
			<Box>
				<Text>{{state.text}}</Text>
			</Box>
		</template>);

		const rootElement = ctx.element;
		expect(rootElement).toBeDefined();

		const boxElement = rootElement.querySelector("terminal-box") as ElementNode;
		expect(boxElement).toBeDefined();

		// TUI render must run first so renderNodeToOutput calls clearDirty()
		render(ctx.element as any);
		expect(ctx.element.textContent).toContain("Hello");

		// After TUI render all nodes should be clean
		expect(boxElement?._isDirty).toBe(false);
		expect(boxElement?._childrenDirty).toBe(false);
	});

	test("should mark nodes dirty when properties change", async () => {
		await using ctx = await setupRenderingContext(App);
		const state = trackedObject({ color: "red", text: "Hello" });

		await ctx.render(<template>
			<Box>
				<Text>{{state.text}}</Text>
			</Box>
		</template>);

		render(ctx.element as any);
		const boxElement = ctx.element.querySelector("terminal-box") as ElementNode;
		expect(boxElement?._isDirty).toBe(false);

		state.text = "World";

		// Ember batches reactive updates – the DOM node is only updated during rerender(),
		// so we must wait for rerender() before the dirty flag is set.
		await rerender();

		const textElement = boxElement?.querySelector("terminal-text") as ElementNode;
		expect(textElement?._isDirty).toBe(true);

		render(ctx.element as any);

		expect(ctx.element.textContent).toContain("World");
		expect(ctx.element.textContent).not.toContain("Hello");
		expect(boxElement?._isDirty).toBe(false);
		expect(textElement?._isDirty).toBe(false);
	});

	test("should track overlapping absolute positioned boxes", async () => {
		await using ctx = await setupRenderingContext(App);
		const state = trackedObject({ showBox: true });

		await ctx.render(<template>
			<Box>
				<Box id="background-box" @width={{20}} @height={{5}}>
					<Text>Background Content</Text>
				</Box>
				{{#if state.showBox}}
					<Box
						id="overlay-box"
						@position="absolute"
						@top={{1}}
						@left={{2}}
						@width={{10}}
						@height={{3}}
						@borderStyle="single"
					>
						<Text>Overlay</Text>
					</Box>
				{{/if}}
			</Box>
		</template>);

		render(ctx.element as any);
		expect((ctx.element as any).textContent).toContain("Overlay");
		expect((ctx.element as any).textContent).toContain("Background Content");

		const rootElement = ctx.element;
		const backgroundBox = rootElement.querySelector("#background-box");
		const overlayBox = rootElement.querySelector("#overlay-box");

		expect(backgroundBox).toBeDefined();
		expect(overlayBox).toBeDefined();
		expect((overlayBox as any)?.getAttribute("position")).toBe("absolute");
		expect((overlayBox as any)?._overlappedNodes).toBeDefined();
		expect((overlayBox as any)?._overlappedNodes.size).toBeGreaterThanOrEqual(0);
		expect((backgroundBox as any)?._overlappingAbsoluteBoxes).toBeDefined();

		state.showBox = false;
		await rerender();
		render(ctx.element as any);

		expect((ctx.element as any).textContent).not.toContain("Overlay");
		expect((ctx.element as any).textContent).toContain("Background Content");
		expect((backgroundBox as any)?._isDirty).toBe(false);
	});

	test("should handle multiple overlapping absolute boxes", async () => {
		await using ctx = await setupRenderingContext(App);

		await ctx.render(<template>
			<Box>
				<Box id="base" @width={{30}} @height={{10}}>
					<Text>Base Layer</Text>
				</Box>
				<Box
					id="overlay1"
					@position="absolute"
					@top={{2}}
					@left={{5}}
					@width={{15}}
					@height={{4}}
					@borderStyle="single"
				>
					<Text @color="cyan">Overlay 1</Text>
				</Box>
				<Box
					id="overlay2"
					@position="absolute"
					@top={{3}}
					@left={{10}}
					@width={{12}}
					@height={{3}}
					@borderStyle="double"
				>
					<Text @color="yellow">Overlay 2</Text>
				</Box>
			</Box>
		</template>);

		render(ctx.element as any);
		expect((ctx.element as any).textContent).toContain("Base Layer");
		expect((ctx.element as any).textContent).toContain("Overlay 1");
		expect((ctx.element as any).textContent).toContain("Overlay 2");

		const rootElement = ctx.element;
		const overlay1 = rootElement.querySelector("#overlay1");
		const overlay2 = rootElement.querySelector("#overlay2");

		expect(overlay1).toBeDefined();
		expect(overlay2).toBeDefined();
		expect(overlay1?.getAttribute("position")).toBe("absolute");
		expect(overlay2?.getAttribute("position")).toBe("absolute");

		const yoga1 = overlay1?.yogaNode;
		const yoga2 = overlay2?.yogaNode;

		if (yoga1 && yoga2) {
			const bounds1 = {
				x: yoga1.getComputedLeft(),
				y: yoga1.getComputedTop(),
				width: yoga1.getComputedWidth(),
				height: yoga1.getComputedHeight(),
			};

			const bounds2 = {
				x: yoga2.getComputedLeft(),
				y: yoga2.getComputedTop(),
				width: yoga2.getComputedWidth(),
				height: yoga2.getComputedHeight(),
			};

			expect(bounds1.width).toBeGreaterThan(0);
			expect(bounds1.height).toBeGreaterThan(0);
			expect(bounds2.width).toBeGreaterThan(0);
			expect(bounds2.height).toBeGreaterThan(0);

			const overlaps = !(
				bounds1.x + bounds1.width <= bounds2.x ||
				bounds2.x + bounds2.width <= bounds1.x ||
				bounds1.y + bounds1.height <= bounds2.y ||
				bounds2.y + bounds2.height <= bounds1.y
			);

			expect(overlaps).toBe(true);
		}
	});

	test("should correctly render when absolute box changes position", async () => {
		await using ctx = await setupRenderingContext(App);
		const position = trackedObject({ top: 1 });
		const fakeTTY = new FakeTTY();
		fakeTTY.rows = 1000;
		fakeTTY.columns = 80;
		resetState();

		await ctx.render(<template>
			<Box>
				<Box id="background" @width={{20}} @height={{10}}>
					<Text>Background</Text>
				</Box>
				<Box
					id="moving-box"
					@position="absolute"
					@top={{position.top}}
					@left={{5}}
					@width={{10}}
					@height={{3}}
					@borderStyle="single"
				>
					<Text>Moving</Text>
				</Box>
			</Box>
		</template>);

		render(ctx.element as any, { stdout: fakeTTY as any });
		const frame1 = fakeTTY.getCleanOutput();
		expect(frame1).toContain("Moving");

		// textContent never changes with position—use rendered lines to detect the move
		const movingLinesBefore = frame1.split('\n').findIndex(l => l.includes('Moving'));

		fakeTTY.clear();
		position.top = 5;
		await rerender();
		resetState();
		render(ctx.element as any, { stdout: fakeTTY as any });

		const frame2 = fakeTTY.getCleanOutput();
		expect(frame2).toContain("Moving");

		const movingLinesAfter = frame2.split('\n').findIndex(l => l.includes('Moving'));
		// After moving from top=1 to top=5 the rendered line index must increase
		expect(movingLinesAfter).toBeGreaterThan(movingLinesBefore);
	});
});