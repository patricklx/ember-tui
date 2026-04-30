import "./globalSetup";
import { setupRenderingContext } from 'ember-vitest';
import App from '../app/app';
import { describe, test, expect as hardExpect } from "vitest";
import { Text, render } from "ember-tui";
import { rerender } from "@ember/test-helpers";
import { trackedObject } from "@ember/reactive/collections";

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
