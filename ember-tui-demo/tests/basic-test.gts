import "./globalSetup";
import { setupRenderingContext } from 'ember-vitest';
import App from '../app/app';
import { describe, test, expect as hardExpect, beforeEach } from "vitest";
import { Text, Box, render } from "ember-tui";
import { rerender } from "@ember/test-helpers";
import { trackedObject } from "@ember/reactive/collections";
import { FakeTTY } from "ember-tui/test-utils/FakeTTY";

const expect = hardExpect.soft;


describe("example", () => {
	test("it works", async () => {
		await using ctx = await setupRenderingContext(App);
		const state = trackedObject({ value: "hello there" });

		await ctx.render(<template><Text @backgroundColor="green">{{state.value}}</Text></template>);

		expect(ctx.element.textContent).toContain("hello there");
		render(ctx.element);
		state.value = "hello world";
		await rerender();
		expect(ctx.element.textContent).toContain("hello world");
	});

	test("nested text works", async () => {
		await using ctx = await setupRenderingContext(App);
		const state = trackedObject({ value: "hello there" });

		await ctx.render(<template><Text>hi<Text @backgroundColor="green">{{state.value}}</Text></Text></template>);

		expect(ctx.element.textContent).toContain("hello there");
		render(ctx.element);
		state.value = "hello world";
		await rerender();
		expect(ctx.element.textContent).toContain("hi");
		expect(ctx.element.textContent).toContain("hello world");
		expect(ctx.element.textContent.split('hello').length).toEqual(2);
	});
});

describe("background color clearing", () => {
	let fakeTTY: FakeTTY;

	beforeEach(() => {
		fakeTTY = new FakeTTY();
		fakeTTY.rows = 1000; // Use large rows to avoid scroll buffer logic
		fakeTTY.columns = 80;
	});

	test("should reset ANSI codes when changing background colors", async () => {
		await using ctx = await setupRenderingContext(App);
		const state = trackedObject({ backgroundColor: "red", text: "Red Background" });

		await ctx.render(<template><Text @backgroundColor={{state.backgroundColor}}>{{state.text}}</Text></template>);
		render(ctx.element, { stdout: fakeTTY as any });

		// Clear and force a second render with different content
		fakeTTY.clear();

		// Change to green background
		state.backgroundColor = "green";
		state.text = "Green Background";
		await rerender();
		render(ctx.element, { stdout: fakeTTY as any });

		// Verify the output contains the new text
		const cleanOutput = fakeTTY.getCleanOutput();
		expect(cleanOutput).toContain("Green Background");

		// Verify ANSI reset code was written (check raw output)
		const rawOutput = fakeTTY.output.join('');
		expect(rawOutput).toContain('\x1b[0m'); // ANSI reset code
	});

	test("should clear line from start when new text is prefixed with spaces", async () => {
			await using ctx = await setupRenderingContext(App);
		const state = trackedObject({ text: "Green Text" });

		await ctx.render(<template><Text @color="green">{{state.text}}</Text></template>);
		render(ctx.element, { stdout: fakeTTY as any });

		fakeTTY.clear();

		// Change to completely different text (triggers segment at position 0)
		state.text = "   Plain Text";
		await rerender();
		render(ctx.element, { stdout: fakeTTY as any });

		const cleanOutput = fakeTTY.getCleanOutput();
		// The test validates that the line was updated and old content cleared
		expect(cleanOutput).toContain("Plain Text");
		expect(cleanOutput).not.toContain("Green");
	});

	test("should clear line from cursor when new text is shorter", async () => {
		await using ctx = await setupRenderingContext(App);
		const state = trackedObject({ text: "Long text with blue background" });

		await ctx.render(<template><Text @backgroundColor="blue">{{state.text}}</Text></template>);
		render(ctx.element, { stdout: fakeTTY as any });

		fakeTTY.clear();

		// Change to much shorter text (triggers clearLineFromCursor for last segment)
		state.text = "Short";
		await rerender();
		render(ctx.element, { stdout: fakeTTY as any });

		// Verify the shorter text is rendered correctly
		const cleanOutput = fakeTTY.getCleanOutput();
		expect(cleanOutput).toContain("Short");
		expect(cleanOutput).not.toContain("Long text with blue background");
	});

	test("should clear entire line when text becomes empty", async () => {
		await using ctx = await setupRenderingContext(App);
		const state = trackedObject({ text: "Some text here" });

		await ctx.render(<template><Text>{{state.text}}</Text></template>);
		render(ctx.element, { stdout: fakeTTY as any });

		fakeTTY.clear();

		// Change to empty text (triggers clearEntireLine in updateLineMinimal)
		state.text = "";
		await rerender();
		render(ctx.element, { stdout: fakeTTY as any });

		// Verify the line is cleared (no text remains)
		const cleanOutput = fakeTTY.getCleanOutput();
		expect(cleanOutput).not.toContain("Some text here");
		// Empty text should result in empty or minimal output
		expect(cleanOutput.trim()).toBe("");
	});

	test("should handle background color removal", async () => {
		await using ctx = await setupRenderingContext(App);
		const state = trackedObject({ backgroundColor: "red", text: "Text with background" });

		await ctx.render(<template><Text @backgroundColor={{state.backgroundColor}}>{{state.text}}</Text></template>);
		render(ctx.element, { stdout: fakeTTY as any });

		fakeTTY.clear();

		// Remove background
		state.backgroundColor = undefined as any;
		state.text = "Text without background";
		await rerender();
		render(ctx.element, { stdout: fakeTTY as any });

		// Verify the new text is rendered
		const cleanOutput = fakeTTY.getCleanOutput();
		expect(cleanOutput).toContain("Text without background");

		// Verify ANSI reset code was written to clear old background (check raw output)
		const rawOutput = fakeTTY.output.join('');
		expect(rawOutput).toContain('\x1b[0m'); // ANSI reset code
	});

	test("should handle multiple color changes in sequence", async () => {
		await using ctx = await setupRenderingContext(App);
		const state = trackedObject({ color: "red", text: "Red" });

		await ctx.render(<template><Text @color={{state.color}}>{{state.text}}</Text></template>);
		render(ctx.element, { stdout: fakeTTY as any });

		fakeTTY.clear();

		// Second render
		state.color = "green";
		state.text = "Green";
		await rerender();
		render(ctx.element, { stdout: fakeTTY as any });

		fakeTTY.clear();

		// Third render
		state.color = "blue";
		state.text = "Blue";
		await rerender();
		render(ctx.element, { stdout: fakeTTY as any });

		// Verify the final text is rendered
		const cleanOutput = fakeTTY.getCleanOutput();
		expect(cleanOutput).toContain("Blue");

		// Verify ANSI reset code was written in the last render (check raw output)
		const rawOutput = fakeTTY.output.join('');
		expect(rawOutput).toContain('\x1b[0m'); // ANSI reset code
	});
});

describe("Box component", () => {
	let fakeTTY: FakeTTY;

	beforeEach(() => {
		fakeTTY = new FakeTTY();
		fakeTTY.rows = 1000;
		fakeTTY.columns = 80;
	});

	describe("borders", () => {
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
			const state = trackedObject({ borderStyle: "single" as const });

			await ctx.render(<template>
				<Box @borderStyle={{state.borderStyle}}>
					<Text>Dynamic Border</Text>
				</Box>
			</template>);

			render(ctx.element, { stdout: fakeTTY as any });
			let cleanOutput = fakeTTY.getCleanOutput();
			expect(cleanOutput).toMatch(/[┌┐└┘│─]/);

			fakeTTY.clear();
			state.borderStyle = "double";
			await rerender();
			render(ctx.element, { stdout: fakeTTY as any });

			cleanOutput = fakeTTY.getCleanOutput();
			expect(cleanOutput).toMatch(/[╔╗╚╝║═]/);
		});
	});

	describe("border colors", () => {
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

	describe("positioning", () => {
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

	describe("colors", () => {
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

	describe("combined features", () => {
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
				borderStyle: "single" as const,
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
			state.borderStyle = "double";
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

	describe("overlay", () => {
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

		test("should overlay only on non-empty spaces", async () => {
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

			// Characters A, B, C should be preserved
			expect(cleanOutput).toContain("A");
			expect(cleanOutput).toContain("B");
			expect(cleanOutput).toContain("C");
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
	});
});
