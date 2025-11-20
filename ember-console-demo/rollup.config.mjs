import { babel } from '@rollup/plugin-babel';
import { nodeResolve } from '@rollup/plugin-node-resolve';
import commonjs from '@rollup/plugin-commonjs';
import json from '@rollup/plugin-json';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Content-tag preprocessor for .gts files
import ContentTag from 'content-tag';
const Preprocessor = new ContentTag.Preprocessor();

// Plugin to preprocess .gts files
function gtsPreprocessor() {
  return {
    name: 'gts-preprocessor',
    transform(code, id) {
      if (id.endsWith('.gts') || id.endsWith('.gjs')) {
        const result = Preprocessor.process(code, {
          inline_source_map: true,
        });
        return {
          code: result.code,
          map: null,
        };
      }
      return null;
    },
  };
}

// Plugin to set up ember-source aliases
function emberSourceAliases() {
  const emberSourcePath = path.resolve(__dirname, 'node_modules/ember-source/dist/packages');

  // Get all @glimmer packages
  const glimmerPath = path.join(emberSourcePath, '@glimmer');
  const glimmerDirs = fs.existsSync(glimmerPath)
    ? fs.readdirSync(glimmerPath)
    : [];

  return {
    name: 'ember-source-aliases',
    resolveId(source) {
      // Handle @ember/* imports
      if (source.startsWith('@ember/')) {
        let resolved = path.join(emberSourcePath, source, 'index.js');
        if (fs.existsSync(resolved)) {
          return resolved;
        }
				resolved = path.join(emberSourcePath, source);
				return this.resolve(resolved);
      }

      // Handle @glimmer/* imports
      if (source.startsWith('@glimmer/')) {
        const glimmerPackage = source.replace('@glimmer/', '');
        if (glimmerDirs.includes(glimmerPackage)) {
          const resolved = path.join(glimmerPath, glimmerPackage, 'index.js');
          if (fs.existsSync(resolved)) {
            return resolved;
          }
        }
      }

      // Handle ember imports
      if (source === 'ember') {
        const resolved = path.join(emberSourcePath, 'ember/index.js');
        if (fs.existsSync(resolved)) {
          return resolved;
        }
      }

      return null;
    },
  };
}

export default {
  input: 'src/index.ts',
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
    // Keep these as external
    'chalk',
    'yoga-layout',
  ],
  plugins: [
    emberSourceAliases(),
    gtsPreprocessor(),
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
      configFile: path.resolve(__dirname, 'babel.config.cjs'),
    }),
  ],
};
