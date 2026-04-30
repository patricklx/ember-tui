import { fileURLToPath, pathToFileURL } from 'node:url';
import path from 'node:path';
import { createServer } from 'vite';
import { appendFileSync, existsSync, readFileSync, statSync } from 'node:fs';

function log(...args) {
  appendFileSync('log.txt', args.join(' '));
  appendFileSync('log.txt', '\n');
}

// Setup browser globals for Vite HMR before any modules load
if (typeof window === 'undefined') {
  globalThis.window = globalThis;
}

if (!globalThis.window.location) {
  globalThis.window.location = {
    protocol: 'http:',
    hostname: 'localhost',
    port: '5173',
    pathname: '/',
    search: '',
    hash: '',
    host: 'localhost:5173',
    origin: 'http://localhost:5173',
    href: 'http://localhost:5173/',
    reload() {},
    replace() {},
    assign() {},
  };
}


// Setup error handling
process.on('uncaughtException', function (err) {
  console.error((new Date()).toUTCString() + ' uncaughtException:', err.message);
  console.error(err.stack);
  process.exit(1);
});

const root = path.dirname(fileURLToPath(import.meta.url));

function fromFileUrl(url) {
  return url.startsWith('file://') ? fileURLToPath(url) : url;
}

function toFileUrl(filePath) {
  return filePath.startsWith('file://') ? filePath : pathToFileURL(filePath).href;
}

function withoutQuery(value) {
  return value.split('?')[0];
}



// Create Vite dev server for module resolution and HMR
const devServer = await createServer({
  configFile: path.join(root, 'vite.config.mjs'),
  root,
  server: {
    middlewareMode: true,
    watch: {
      ignored: ['**/node_modules/**', '**/.git/**'],
    },
  },
  optimizeDeps: {
    noDiscovery: true,
    include: [],
  },
});

await devServer.pluginContainer.buildStart({});

async function viteResolve(source, importer) {
  const resolved = await devServer.pluginContainer.resolveId(source, importer);

  if (!resolved) {
    return null;
  }

  return typeof resolved === 'string' ? { id: resolved } : { id: resolved.id };
}

async function viteLoad(id) {
  const resolvedId = withoutQuery(id);
  const result = await devServer.pluginContainer.load(resolvedId);

  if (!result) {
    return null;
  }

  return typeof result === 'string' ? result : result.code;
}

async function viteTransformRequest(id) {
  const result = await devServer.transformRequest(id);

  if (!result) {
    return null;
  }

  return result.code;
}

let isLoading = 0;
const loadingStack = [];

// Node.js loader resolve hook
export async function resolve(specifier, context, nextResolve) {
  log('resolve', specifier);
  if (specifier.startsWith('/@id/node:')) {
    specifier = specifier.replace('/@id/', '');
  }
  if (specifier.startsWith('/@id/')) {
    specifier = specifier.replace('/@id/', '');
    log('resolve to', specifier);
    return {
      url: toFileUrl(specifier),
      format: 'module',
      shortCircuit: true,
    }
  }
  if (specifier.startsWith('/@fs/')) {
    specifier = specifier.replace('/@fs', '');
  }
  try {
    return await nextResolve(specifier, context);
  } catch (e) {
    log('next resolve failed', specifier, e);
  }

  if (context.parentURL) {
    let parentURL = fromFileUrl(context.parentURL);
    if (parentURL.startsWith('/app')) {
      parentURL = path.join(root, parentURL);
      context.parentURL = toFileUrl(parentURL);
    }
  }


  specifier = fromFileUrl(specifier);

  if (specifier.includes('.embroider/content-for.json')) {
    return {
      url: toFileUrl(path.resolve('node_modules', '.embroider/content-for.json')),
      format: 'module',
      shortCircuit: true,
    }
  }

  if (withoutQuery(specifier).endsWith('.json')) {
    return nextResolve(specifier, context);
  }

  if (specifier.startsWith('.')) {
    specifier = path.resolve(fromFileUrl(context.parentURL), '..', specifier);
  }
  log('check sub resolve', specifier);
  if (specifier.startsWith('/') && !existsSync(withoutQuery(specifier)) && !context.isSubResolve) {
    let s = specifier.slice(1);
    log('try sub resolve', s);
    try {
      return await resolve(s, { ...context, isSubResolve: true }, nextResolve);
    } catch {
      // pass
    }
    s = path.join(root, specifier);
    log('try sub resolve 2', s);
    try {
      return await resolve(s, { ...context, isSubResolve: true }, nextResolve);
    } catch {
      // pass
    }
    log('resolve full', specifier);
    return {
      url: toFileUrl(specifier),
      format: 'module',
      shortCircuit: true,
    };
  }

  const importer = context.parentURL ? fromFileUrl(withoutQuery(context.parentURL)) : path.join(root, 'index.html');
  const resolved = await viteResolve(specifier, importer);

  if (!resolved?.id) {
    return await nextResolve(specifier, context);
  }

  return {
    url: toFileUrl(resolved.id),
    format: 'module',
    shortCircuit: true,
  };
}


// Helper to detect if content is CommonJS
function isCommonJS(content) {
  if (!content || typeof content !== 'string') return false;

  // Remove comments to avoid false positives
  const withoutComments = content
    .replace(/\/\*[\s\S]*?\*\//g, '') // Remove /* */ comments
    .replace(/\/\/.*/g, ''); // Remove // comments

  // Check for CommonJS patterns (must be actual code, not in strings)
  const hasModuleExports = /\bmodule\.exports\s*[=[]/.test(withoutComments);
  const hasExportsAssignment = /\bexports\.\w+\s*=/.test(withoutComments);
  const hasExportsBracket = /\bexports\[/.test(withoutComments);

  // Only consider it CJS if it has exports AND no ESM syntax
  const hasESM = /\b(import|export)\s+/.test(withoutComments);

  return (hasModuleExports || hasExportsAssignment || hasExportsBracket) && !hasESM;
}

// Node.js loader load hook
export async function load(url, context, nextLoad) {
  const cleanUrl = withoutQuery(url);

  if (cleanUrl.startsWith('node:')) {
    return nextLoad(url, context);
  }

  if (isLoading) {
    log('directly load', cleanUrl);
    const filePath = fromFileUrl(cleanUrl);
    if (filePath.endsWith('.json')) {
      const content = readFileSync(filePath).toString();
      return {
        format: 'module',
        source: `export default ${content}`,
        shortCircuit: true,
      };
    }
    return nextLoad(toFileUrl(withoutQuery(filePath)), context);
  }

  // Detect recursion: if this module is already being loaded
  if (loadingStack.includes(url)) {
    const filePath = fromFileUrl(cleanUrl);
    // Only throw error for our own code, not node_modules
    if (filePath.includes('/app/') || filePath.includes('/ember-tui/src/')) {
      const stackArray = Array.from(loadingStack).map(fromFileUrl);
      const errorMsg = `Circular dependency detected: ${cleanUrl} ${JSON.stringify(context)}\n\nLoading stack (${loadingStack.length} modules):\n${stackArray.map((url, i) => `  ${i}: ${url}`).join('\n')}`;
      console.error(`[loader] ${errorMsg}`);
      throw new Error(errorMsg);
    }
    // For node_modules, just delegate to nextLoad
    console.warn(`[loader] Circular dependency in dependency (allowed): ${cleanUrl}`);
    return nextLoad(url, context);
  }

  if (url.includes('node_modules') && !url.includes('vite/dist/client') && !url.includes('.json') && !url.includes('ember-vite-hmr')) {
    const filePath = fromFileUrl(cleanUrl);
    try {
      if (existsSync(filePath)) {
        const source = readFileSync(filePath).toString();
        if (!source?.includes('@embroider/macros') && !source.includes('precompileTemplate')) {
          const format = isCommonJS(source) ? 'commonjs' : 'module';
          return {
            format,
            source,
            shortCircuit: true,
          };
        }
      }
    } catch (e) {
      console.error(e);
    }
  }

  try {
    isLoading += 1;
    loadingStack.push(url);
    const filePath = fromFileUrl(cleanUrl);

    if (filePath.endsWith('.json')) {
      const content = readFileSync(filePath).toString();
      return {
        format: 'module',
        source: `export default ${content}`,
        shortCircuit: true,
      };
    }

    let transformedCode = await viteTransformRequest(filePath);

    if (!transformedCode) {
      let content = await viteLoad(cleanUrl);

      if (!content && existsSync(filePath) && statSync(filePath).isFile()) {
        content = readFileSync(filePath, 'utf-8');
      }

      if (!content) {
        return nextLoad(url, context);
      }

      transformedCode = content;
    }

    const format = isCommonJS(transformedCode) ? 'commonjs' : 'module';

    return {
      format,
      source: transformedCode,
      shortCircuit: true,
    };
  } catch (error) {
    console.error('[loader] Error loading module:', cleanUrl, error);
    throw error;
  }
  finally {
    isLoading -= 1;
  }
}
