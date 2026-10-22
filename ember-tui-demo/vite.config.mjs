import { defineConfig } from "vite";
import path from "node:path";
import { ember, extensions } from "@embroider/vite";
import { babel } from "@rollup/plugin-babel";
import { hmr } from "ember-vite-hmr";
import { builtinModules, createRequire } from "node:module";

const inline = ['ember-vitest', 'ember-tui', '@glimmer/component'];

// Absolute path, so embroider's resolver doesn't reject the alias as an
// undeclared dependency of ember-vitest.
const vitestBrowserShim = createRequire(import.meta.url).resolve('ember-tui/test-utils/vitest-browser-shim');

export default defineConfig({
	resolve: {
		alias: {
			'.embroider': './node_modules/.embroider'
		},
		conditions: ['node', 'import', 'require', 'default'],
	},
	ssr: {
		noExternal: ['chalk', 'ansi-styles'],
		external: [...builtinModules, ...builtinModules.map(m => `node:${m}`)],
	},
	build: {
		rollupOptions: {
			external: [...builtinModules, ...builtinModules.map(m => `node:${m}`)],
		},
	},
	// Add this config
	test: {
		environment: "node",
		include: ["./tests/**/*-test.{gjs,gts}"],
		// ember-vitest imports `vitest/browser`, which only works in Browser Mode.
		alias: {
			'vitest/browser': vitestBrowserShim,
		},
		deps: {
			inline,
		},
		maxConcurrency: 1,
		// The persistent module cache (on by default since vitest 5) keeps stale
		// transforms of embroider's virtual modules, failing every run after the first.
		fsModuleCache: false,
		server: {
			deps: {
				inline,
			},
		},
	},
	// For dev server (if needed)
	server: {
		deps: {
			inline,
		},
		hmr: {
			protocol: 'ws',
			host: 'localhost',
			port: 24678,
			clientPort: 24678,
			path: '/',
			timeout: 30000,
		},
	},
	// Existing config:
	plugins: [
		{
			enforce: 'pre',
			resolveId(id) {
				if (id.startsWith('node:')) {
					return id;
				}
				if (builtinModules.includes(id)) {
					return `node:${id}`;
				}
				if (id.includes('.embroider/content-for.json')) {
					return path.resolve(process.cwd(), 'node_modules', '.embroider', 'content-for.json');
				}
			}
		},
		ember(),
		babel({
			sourceMaps: 'inline',
			babelHelpers: "runtime",
			extensions,
		}),
		hmr(),
	],
});
