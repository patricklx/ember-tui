import path, { resolve as resolvePath } from 'path';
import { fileURLToPath } from 'url';
import { existsSync, statSync, readFileSync, realpathSync } from 'fs';
import { transformSync } from '@babel/core';
import babelConfig from './babel.config.cjs';
import { resolver, templateTag } from '@embroider/vite';


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
      } catch {
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
      } catch {
        // Continue to next extension
      }
    }
  }
  return null;
}

const emberResolver = resolver();
const emberTemplateTag = templateTag();



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
        conditions: ['import', 'node', 'module-sync', 'node-addons'],
        importAttributes: {},
        parentURL: from
      });
      return {
        id: res.url,
      }
    } catch (error) {
      console.error(error);
      return null;
    }
  }
});

export async function resolve(specifier, context, nextResolve) {
	if (specifier.endsWith('-embroider-implicit-modules.js')) {
		return {
			url: `file://${specifier}`,
			format: 'module',
			shortCircuit: true,
		};
	}

  // Force emoji-regex to use ESM (.mjs) instead of CommonJS (.js)
  if (specifier === 'emoji-regex') {
    const resolved = await nextResolve(specifier, {
      ...context,
      conditions: ['import', 'node', 'module-sync', 'node-addons'],
    });
    if (resolved.url.endsWith('/index.js')) {
      return {
        ...resolved,
        url: resolved.url.replace('/index.js', '/index.mjs'),
        shortCircuit: true,
      };
    }
    return resolved;
  }

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
    return nextResolve(res.id, {
      ...context,
      conditions: ['import', 'node', 'module-sync', 'node-addons'],
    });
  }
  return nextResolve(specifier, {
    ...context,
    conditions: ['import', 'node', 'module-sync', 'node-addons'],
  });
}

export async function load(url, context, nextLoad) {

	if (url.endsWith('-embroider-implicit-modules.js')) {
		return {
			format: 'module',
			source: 'export default {}',
			shortCircuit: true,
		};
	}

  // Handle tinygradient CommonJS module
  if (url.includes('tinygradient') && url.includes('node_modules')) {
    try {
      const filePath = fileURLToPath(url);
      readFileSync(filePath, 'utf8');
      // Wrap CommonJS in ESM wrapper
      const wrappedSource = `
        import { createRequire } from 'module';
        const require = createRequire(import.meta.url);
        const mod = require('${filePath}');
        export default mod;
      `;
      return {
        format: 'module',
        source: wrappedSource,
        shortCircuit: true,
      };
    } catch (error) {
      console.error('Error wrapping tinygradient:', error);
    }
  }

  let filePath = url;
  try {
    filePath = fileURLToPath(url);
    filePath = realpathSync(filePath);
  } catch {
    // Ignore errors
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
