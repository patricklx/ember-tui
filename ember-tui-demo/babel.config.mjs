import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  babelCompatSupport,
  templateCompatSupport,
} from '@embroider/compat/babel';
import { hotAstProcessor } from 'ember-vite-hmr/lib/babel-plugin';
import { createHotContextInjectionPlugin } from 'ember-tui/hmr-babel';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);

const hotContextInjectionPlugin = (babel) =>
  createHotContextInjectionPlugin(babel, {
    hmrRuntimeImport: require.resolve('ember-tui/hmr'),
    exclude: (filename) =>
      filename.endsWith('/hmr.ts') ||
      filename.endsWith('/hmr.js') ||
      filename.includes('node_modules') && !filename.includes('ember-vite-hmr'),
  });

export default {
  plugins: [
    ['ember-vite-hmr/lib/babel-plugin'],
    hotContextInjectionPlugin,
    [
      '@babel/plugin-transform-typescript',
      {
        allExtensions: true,
        onlyRemoveTypeImports: true,
        allowDeclareFields: true,
      },
    ],
    [
      'babel-plugin-ember-template-compilation',
      {
        enableLegacyModules: [
          'ember-cli-htmlbars',
          'ember-cli-htmlbars-inline-precompile',
          'htmlbars-inline-precompile',
        ],
        transforms: [...templateCompatSupport(), hotAstProcessor.transform],
      },
    ],
    [
      'module:decorator-transforms',
      {
        runtime: {
          import: resolve('node_modules', 'decorator-transforms', 'dist', 'runtime.js'),
        },
      },
    ],
    [
      '@babel/plugin-transform-runtime',
      {
        absoluteRuntime: dirname(fileURLToPath(import.meta.url)),
        useESModules: true,
        regenerator: false,
      },
    ],
    ...babelCompatSupport(),
  ],

  generatorOpts: {
    compact: false,
  },
};
