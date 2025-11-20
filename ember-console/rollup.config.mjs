import { nodeResolve } from '@rollup/plugin-node-resolve';
import { babel } from '@rollup/plugin-babel';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Content-tag preprocessor for .gts files
import ContentTag from 'content-tag';
import path from "node:path";
import { fileURLToPath } from "node:url";
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

export default {
  input: 'src/index.ts',
  output: {
    dir: 'dist',
    format: 'es',
    preserveModules: true,
    preserveModulesRoot: 'src',
    sourcemap: true,
  },
  external: [
    '@glimmer/component',
    '@glimmer/tracking',
    'chalk',
    'yoga-layout',
  ],
  plugins: [
		gtsPreprocessor(),
    nodeResolve({
      extensions: ['.ts', '.js', '.gts', '.gjs'],
    }),
		babel({
			babelHelpers: 'inline',
			extensions: ['.js', '.ts', '.gts', '.gjs'],
			configFile: path.resolve(__dirname, 'babel.config.cjs'),
		}),
  ],
};
