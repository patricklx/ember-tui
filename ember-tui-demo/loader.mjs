import path, { resolve as resolvePath } from 'path';
import { fileURLToPath } from 'url';
import { existsSync, statSync, readFileSync, realpathSync } from 'fs';
import { transformAsync } from '@babel/core';
import babelConfig from './babel.config.mjs';
import { resolver, templateTag } from '@embroider/vite';
import { ResolverLoader } from '@embroider/core';

process.on('uncaughtException', function (err) {
  console.error((new Date).toUTCString() + ' uncaughtException:', err.message)
  console.error(err.stack)
  process.exit(1)
});

// Helper function to try multiple extensions
function tryExtensions(basePath, extensions = ['js', 'ts', 'gts', 'gjs']) {
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

// Track files currently being transformed to prevent re-entrant calls
const transformingFiles = new Set();

// Global flag to track if ANY babel transform is in progress
let babelTransformInProgress = 0;


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
  try {
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

    if (specifier.includes('.embroider/content-for.json')) {
      specifier = path.resolve('.', 'node_modules', specifier);
    }

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

1

    // Handle relative imports
    if (specifier.startsWith('.')) {
      const parentPath = fileURLToPath(context.parentURL);
      const parentDir = path.dirname(parentPath);
      const fullPath = path.resolve(parentDir, specifier);

      const resolvedPath = tryExtensions(fullPath);
      if (resolvedPath) {
        return {
          url: `file://${resolvedPath}`,
          format: 'module',
          shortCircuit: true,
        };
      }
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
    if (res && (res.id.includes('app') || res.id.includes('node_modules'))) {
      const r = await nextResolve(res.id, {
        ...context,
        conditions: ['import', 'module', 'node', 'commonjs'],
      });
      const f = r.url.replace('file://', '');
      const pkg = resolverloader.resolver.packageCache.ownerOfFile(f);
      const isEmber = pkg?.isEmberAddon() || pkg?.packageJSON.ember;
      const isWarpDrive = f.includes('/@warp-drive/');

      // Force module format for ember addons EXCEPT @warp-drive packages
      // @warp-drive packages are ember addons but use CommonJS format
      if (isEmber && !isWarpDrive) {
        r.format = 'module';
      }
      r.shortCircuit = true;
      return r;
    }
    return nextResolve(specifier, {
      ...context,
      conditions: ['import', 'module', 'node', 'commonjs'],
    });
  } catch (e) {
    console.error(e);
    return nextResolve(specifier, {
      ...context,
    });
  }
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

  // If babel is currently transforming, don't intercept - let Node.js handle it
  // This prevents deadlock when babel tries to resolve imports during transformation
  if (babelTransformInProgress > 0) {
    return nextLoad(url, context);
  }

  if (url.endsWith('-embroider-implicit-modules.js')) {
    return {
      format: 'module',
      source: 'export default {}',
      shortCircuit: true,
    };
  }

  let filePath = url;
  try {
    filePath = fileURLToPath(url);
    filePath = realpathSync(filePath);
  } catch {
    // Ignore errors
  }

  // Don't intercept @warp-drive packages - let Node.js handle them naturally
  // They are pre-compiled and should work as-is
  
  // Don't transform gradient-string or tinygradient - let Node.js handle module resolution
  if (filePath.includes('/gradient-string/') || filePath.includes('/tinygradient/')) {
    return nextLoad(url, context);
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

  try {
    content = (await emberTemplateTag.transform.handler(content, filePath))?.code || content;
  } catch (e) {
    console.error(e);
  }


  // Transform app code, .embroider files, and Ember ecosystem packages that use @embroider/macros
  // ember-source, @ember, @embroider packages have macro imports that need Babel processing
  // ember-tui needs transformation for .gts template compilation
  const shouldTransform = !filePath.includes('node_modules') ||
    filePath.includes('.embroider') ||
    filePath.includes('-embroider-') ||
    filePath.includes('/ember-source/') ||
    filePath.includes('/@ember/') ||
    filePath.includes('/@embroider/') ||
    filePath.includes('/ember-tui/');

  if (!shouldTransform) {
    return nextLoad(url, context);
  }

  // Check if we're already transforming this file (circular dependency)
  if (transformingFiles.has(filePath)) {
    // Return untransformed content to break the cycle
    return {
      format: 'module',
      source: content,
      shortCircuit: true,
    };
  }

  try {
    transformingFiles.add(filePath);
    babelTransformInProgress++;
    const result = await transformAsync(content, {
      ...babelConfig,
      babelrc: false,
      configFile: false,
      filename: filePath,
      sourceMaps: 'inline',
    });

    if (result && result.code) {
      if (result.code.includes('type-fest')) {
        console.log('here');
      }
      return {
        format: 'module',
        source: result.code,
        shortCircuit: true,
      };
    }
  } catch (e) {
    console.error('Transform error for', filePath, ':', e);
    // Don't silently continue - rethrow or return error
    throw e;
  } finally {
    babelTransformInProgress--;
    transformingFiles.delete(filePath);
  }

  return nextLoad(url, context);
}
