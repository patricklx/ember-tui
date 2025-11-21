import path, { resolve as resolvePath, dirname } from 'path';
import { fileURLToPath, pathToFileURL } from 'url';
import { existsSync, readdirSync, statSync, readFileSync, realpathSync } from 'fs';
import { cwd } from 'process';
import { transformSync } from '@babel/core';
import babelConfig from './babel.config.cjs';
import { resolver, templateTag } from '@embroider/vite';


const __dirname = cwd();

// Get ember-source path
const emberSourcePath = resolvePath(__dirname, 'node_modules/ember-source/dist/packages');

// Get all @glimmer packages
const glimmerPath = resolvePath(emberSourcePath, '@glimmer');
const glimmerDirs = existsSync(glimmerPath) ? readdirSync(glimmerPath) : [];

// Helper function to try multiple extensions
function tryExtensions(basePath, extensions = ['js', 'ts', 'gts', '.gjs']) {
  // Try with extensions first
	basePath = basePath
    .replace('.js', '')
    .replace('.ts', '')
    .replace('.gjs', '')
    .replace('.gts', '')
    .replace('file://', '');
  for (const ext of extensions) {
    const fullPath = `${basePath}.${ext}`;
    if (existsSync(fullPath)) {
      try {
        const stats = statSync(fullPath);
        if (stats.isFile()) {
          return fullPath;
        }
      } catch (e) {
        // Continue to next extension
      }
    }
  }

  // Try index files
  for (const ext of extensions) {
    const indexPath = resolvePath(basePath, `index.${ext}`);
    if (existsSync(indexPath)) {
      try {
        const stats = statSync(indexPath);
        if (stats.isFile()) {
          return indexPath;
        }
      } catch (e) {
        // Continue to next extension
      }
    }
  }
  return null;
}

const emberResolver = resolver();
const emberTemplateTag = templateTag();

async function log(...args) {
  const str = args.map(x => typeof x === 'object' ? JSON.stringify(x, null, 2) : x.toString()).join(' ');
  await new Promise(resolve => process.stdout.write(`${str.toString()}
`, resolve))
}

const emberResolverContext = (nextResolve) => ({
  async resolve(spec, from) {
    if (!from.startsWith('file://')) {
      from = `file://${from}`;
    }
    try {
      if (spec.startsWith('ember-source')) {
        from = `file://${path.resolve('./package.json')}`;
      }
      const fullPath = spec.startsWith('.') ? path.resolve(path.dirname(from.slice('file://'.length)), spec) : spec;
      const resolved = tryExtensions(fullPath) || fullPath;
      const res = await nextResolve(resolved, {
        conditions: ['node', 'import', 'module-sync', 'node-addons'],
        importAttributes: {},
        parentURL: from
      });
      return {
        id: res.url,
      }
    } catch (e) {
      console.error(e);
      return null;
    }
  }
});

export async function resolve(specifier, context, nextResolve) {
  const emberContext = emberResolverContext(nextResolve);
  const res = await emberResolver.resolveId.call(emberContext, specifier, context.parentURL || path.resolve('./package.json'), {});
  if (res?.id.includes('-embroider')) {
    return {
      url: `file://${res.id}`,
      format: 'module',
      shortCircuit: true,
    };
  }
  if (res) {
    return nextResolve(res.id, context);
  }
  return nextResolve(specifier, context);
}

export async function load(url, context, nextLoad) {
  let filePath = url;
  try {
    filePath = fileURLToPath(url);
    filePath = realpathSync(filePath);
  } catch (e) {

  }


  let content = emberResolver.load(filePath);
  if (existsSync(filePath)) {
    content = readFileSync(filePath, 'utf8');
  }

  if (url.endsWith('.json')) {
    return {
      format: 'module',
      source: 'export default ' + content,
      shortCircuit: true,
    };
  }

  content = emberTemplateTag.transform(content, filePath)?.code || content;

  if (!content) {
    return nextLoad(url, context);
  }

  const result = transformSync(content, {
    ...babelConfig,
    filename: filePath,
    sourceMaps: 'inline',
  });

  if (result && result.code) {
    return {
      format: 'module',
      source: result.code,
      shortCircuit: true,
    };
  }

  // Let Node.js handle all other files
  return nextLoad(url, context);
}
