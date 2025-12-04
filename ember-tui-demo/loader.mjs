import path, { resolve as resolvePath } from 'path';
import { fileURLToPath } from 'url';
import { existsSync, statSync, readFileSync, realpathSync } from 'fs';
import { transformSync } from '@babel/core';
import babelConfig from './babel.config.cjs';
import { resolver, templateTag } from '@embroider/vite';
import { ResolverLoader } from '@embroider/core';


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
const resolverloader = new ResolverLoader(process.cwd());


const emberResolverContext = (nextResolve) => ({
  async resolve(spec, from) {
    // Skip built-in Node.js modules
    if (spec.startsWith('node:')) {
      return null;
    }
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
        format: res.format,
      }
    } catch {
      return null;
    }
  }
});

export async function resolve(specifier, context, nextResolve) {
  if (specifier.startsWith('node:')) {
    return nextResolve(specifier, context);
  }
  if (specifier.endsWith('-embroider-implicit-modules.js')) {
    return {
      url: `file://${specifier}`,
      format: 'module',
      shortCircuit: true,
    };
  }

  if (specifier.startsWith('node:')) {
    return nextResolve(specifier, context);
  }

  if (specifier.includes('.embroider/content-for.json')) {
    specifier = path.resolve('.', 'node_modules', specifier);
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
  const res = await emberResolver.resolveId.call(emberContext, specifier, context.parentURL?.replace('file://', '') || path.resolve('./package.json'), {});
  if (res?.id.includes('-embroider')) {
    return {
      url: `file://${res.id}`,
      format: 'module',
      shortCircuit: true,
    };
  }
  if (res) {
    const r = await nextResolve(res.id, {
      ...context,
      conditions: ['import', 'node', 'module-sync', 'node-addons'],
    });
    const f = r.url.replace('file://', '');
    const pkg = resolverloader.resolver.packageCache.ownerOfFile(f);
    const isEmber = pkg?.isEmberAddon() || pkg?.packageJSON.ember;
    r.format = isEmber ? 'module' : r.format ;
    return r;
  }
  return nextResolve(specifier, {
    ...context,
    conditions: ['import', 'node', 'module-sync', 'node-addons'],
  });
}

export async function load(url, context, nextLoad) {
  // Skip built-in Node.js modules - don't intercept them at all
  if (url.startsWith('node:')) {
    return {
      format: 'builtin',
      source: null,
      shortCircuit: true,
    }
  }

  if (url.endsWith('-embroider-implicit-modules.js')) {
    return {
      format: 'module',
      source: 'export default {}',
      shortCircuit: true,
    };
  }

  // Handle CommonJS modules in node_modules
  if (url.includes('node_modules') && (url.endsWith('.js') || url.endsWith('.cjs'))) {
    // Only wrap if context indicates it's CommonJS (format: 'commonjs')
    // or if format is not specified (let require handle detection)
    if (!context.format || context.format === 'commonjs') {
      try {
        const filePath = fileURLToPath(url);
        // Wrap as CommonJS - let require handle detection
        const wrappedSource = `
          import { createRequire } from 'node:module';
          const require = createRequire(import.meta.url);
          const mod = require('${filePath}');
          export default mod;
        `;
        return {
          format: 'module',
          source: wrappedSource,
          shortCircuit: true,
        };
      } catch {
        // If wrapping fails, let Node.js handle it normally
      }
    }
  }

  let filePath = url;
  try {
    filePath = fileURLToPath(url);
    filePath = realpathSync(filePath);
  } catch {
    // Ignore errors
  }


  let content = await emberResolver.load(filePath);

  if (!content) {
    content = readFileSync(filePath).toString();
  }

  if (url.endsWith('.json')) {
    return {
      format: 'module',
      source: 'export default ' + content,
      shortCircuit: true,
    };
  }

  content = (await emberTemplateTag.transform(content, filePath))?.code || content;

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

  return nextLoad(url, context);
}
