import "./globalSetup";
import { trackedObject } from "@ember/reactive/collections";
import { rerender } from "@ember/test-helpers";
import { setupRenderingContext } from "ember-vitest";
import { describe, test, expect as hardExpect } from "vitest";
import App from "../app/app";
import { Box, Text, render } from "ember-tui";

const expect = hardExpect.soft;

describe("dirty tracking render", () => {
	test("should track dirty nodes after render", async () => {
		await using ctx = await setupRenderingContext(App);
		const state = trackedObject({ color: "red", text: "Hello" });

		await ctx.render(<template>
			<Box @color={{state.color}}>
				<Text>{{state.text}}</Text>
			</Box>
		</template>);

		const rootElement = ctx.element;
		expect(rootElement).toBeDefined();

		const boxElement = rootElement.querySelector("terminal-box");
		expect(boxElement).toBeDefined();

		expect((boxElement as any)._isDirty).toBe(false);
		expect((boxElement as any)._childrenDirty).toBe(false);

		render(ctx.element);
		expect(ctx.element.textContent).toContain("Hello");
	});

	test("should mark nodes dirty when properties change", async () => {
		await using ctx = await setupRenderingContext(App);
		const state = trackedObject({ color: "red", text: "Hello" });

		await ctx.render(<template>
			<Box @color={{state.color}}>
				<Text>{{state.text}}</Text>
			</Box>
		</template>);

		render(ctx.element);
		const boxElement = ctx.element.querySelector("terminal-box");
		expect((boxElement as any)._isDirty).toBe(false);

		state.text = "World";

		const textElement = boxElement?.querySelector("terminal-text");
		expect((textElement as any)._isDirty).toBe(true);

		await rerender();
		render(ctx.element);

		expect(ctx.element.textContent).toContain("World");
		expect(ctx.element.textContent).not.toContain("Hello");
		expect((boxElement as any)._isDirty).toBe(false);
		expect((textElement as any)._isDirty).toBe(false);
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

		render(ctx.element);
		expect(ctx.element.textContent).toContain("Overlay");
		expect(ctx.element.textContent).toContain("Background Content");

		const rootElement = ctx.element;
		const backgroundBox = rootElement.querySelector("#background-box");
		const overlayBox = rootElement.querySelector("#overlay-box");

		expect(backgroundBox).toBeDefined();
		expect(overlayBox).toBeDefined();
		expect(overlayBox?.getAttribute("position")).toBe("absolute");
		expect((overlayBox as any)._overlappedNodes).toBeDefined();
		expect((overlayBox as any)._overlappedNodes.size).toBeGreaterThanOrEqual(0);
		expect((backgroundBox as any)._overlappingAbsoluteBoxes).toBeDefined();

		state.showBox = false;
		await rerender();
		render(ctx.element);

		expect(ctx.element.textContent).not.toContain("Overlay");
		expect(ctx.element.textContent).toContain("Background Content");
		expect((backgroundBox as any)._isDirty).toBe(false);
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

		render(ctx.element);
		expect(ctx.element.textContent).toContain("Base Layer");
		expect(ctx.element.textContent).toContain("Overlay 1");
		expect(ctx.element.textContent).toContain("Overlay 2");

		const rootElement = ctx.element;
		const overlay1 = rootElement.querySelector("#overlay1");
		const overlay2 = rootElement.querySelector("#overlay2");

		expect(overlay1).toBeDefined();
		expect(overlay2).toBeDefined();
		expect(overlay1?.getAttribute("position")).toBe("absolute");
		expect(overlay2?.getAttribute("position")).toBe("absolute");

		const yoga1 = (overlay1 as any)?.yogaNode;
		const yoga2 = (overlay2 as any)?.yogaNode;

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

		render(ctx.element);
		const frame1 = ctx.element.textContent ?? "";
		expect(frame1).toContain("Moving");

		position.top = 5;
		await rerender();
		render(ctx.element);

		const frame2 = ctx.element.textContent ?? "";
		expect(frame2).toContain("Moving");
		expect(frame1).not.toBe(frame2);
	});
});