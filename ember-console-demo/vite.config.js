import { defineConfig } from "vite";
import { ember, extensions } from "@embroider/vite";
import { babel } from "@rollup/plugin-babel";

export default defineConfig({
	// Add this config
	test: {
		environment: "node",
		include: ["./tests/**/*-test.{gjs,gts}"],
		deps: {
			inline: ['ember-vitest'],
		},
		maxConcurrency: 1,
		server: {
			deps: {
				inline: ['ember-vitest'],
			},
		},
	},
	// For dev server (if needed)
	server: {
		deps: {
			inline: ['ember-vitest'],
		},
	},
	// Existing config:
	plugins: [
		ember(),
		babel({
			babelHelpers: "runtime",
			extensions,
		}),
	],
});
