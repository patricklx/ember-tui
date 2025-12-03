import { babel } from '@rollup/plugin-babel';
import { nodeResolve } from '@rollup/plugin-node-resolve';
import commonjs from '@rollup/plugin-commonjs';
import json from '@rollup/plugin-json';
import path from 'path';
import { resolver, templateTag } from '@embroider/vite';

export default {
  input: 'app/app.ts',
  output: {
    dir: 'dist',
    format: 'es',
    sourcemap: true,
    preserveModules: false,
  },
  external: [
    // Node built-ins
    'fs',
    'path',
    'url',
    'util',
    'stream',
    'events',
    'assert',
    'buffer',
    'child_process',
    'crypto',
    'os',
    'tty',
    'process',
    'readline',
    'yoga-layout'
    // Keep these as external
  ].map(x => [x, `node:${x}`]).flat(),
  plugins: [
    resolver(),
    templateTag(),
    nodeResolve({
      extensions: ['.js', '.ts', '.gts', '.gjs', '.json'],
      preferBuiltins: true,
    }),
    commonjs({
      include: /node_modules/,
      transformMixedEsModules: true,
    }),
    json(),
    babel({
      babelHelpers: 'runtime',
      extensions: ['.js', '.ts', '.gts', '.gjs'],
      configFile: path.resolve('./babel.config.cjs'),
    }),
  ],
};
