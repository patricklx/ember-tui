import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  babelCompatSupport,
  templateCompatSupport,
} from '@embroider/compat/babel';
import { hotAstProcessor } from 'ember-vite-hmr/lib/babel-plugin';

export default {
  sourceType: 'module',
  plugins: [
    ['ember-vite-hmr/lib/babel-plugin'],
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
