/**
 * Utilities for Node.js loader customization
 * These functions help create minimal, customizable loaders for Ember TUI apps
 */

import path from 'path';
import { existsSync, statSync, readFileSync, realpathSync } from 'fs';
import { fileURLToPath } from 'url';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);

/**
 * Try to resolve a file path with multiple extensions
 */
export function tryExtensions(
  basePath: string,
  extensions: string[] = ['js', 'ts', 'gts', 'gjs']
): string | null {
  // Clean up the base path
  basePath = basePath
    .replace('.js', '')
    .replace('.ts', '')
    .replace('.gjs', '')
    .replace('.gts', '')
    .replace('file://', '');

  // Try with extensions first
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
    const indexPath = path.resolve(basePath, `index.${ext}`);
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

/**
 * Create an Ember resolver context for use with @embroider/vite resolver
 */
export function createEmberResolverContext(nextResolve: any) {
  return {
    async resolve(spec: string, from: string) {
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
        const fullPath = spec.startsWith('.')
          ? path.resolve(path.dirname(from.slice('file://'.length)), spec)
          : spec;
        const resolved = tryExtensions(fullPath) || fullPath;
        const res = await nextResolve(resolved, {
          conditions: ['import', 'node', 'module-sync', 'node-addons'],
          importAttributes: {},
          parentURL: from,
        });
        return {
          id: res.url,
          format: res.format,
        };
      } catch {
        return null;
      }
    },
  };
}



/**
 * Determine if a file should be transformed based on its path
 */
export function shouldTransformFile(filePath: string): boolean {
  return (
    !filePath.includes('node_modules') ||
    filePath.includes('.embroider') ||
    filePath.includes('-embroider-') ||
    filePath.includes('/ember-source/') ||
    filePath.includes('/@ember/') ||
    filePath.includes('/@embroider/') ||
    filePath.includes('/ember-tui/dist/') ||
    filePath.includes('/ember-vite-hmr/')
  );
}

/**
 * Create a transform context for use with Embroider and HMR plugins
 */
export function createTransformContext(resolveFunction: any) {
  return {
    resolve: async (fileName: string, parent?: string) => {
      // Ensure parent is a file:// URL
      if (parent && !parent.startsWith('file://')) {
        parent = `file://${parent}`;
      }

      const r = await resolveFunction(
        fileName,
        {
          parentURL: parent || `file://${process.cwd()}`,
        },
        (fileName: string) => {
          fileName = fileName.replace('file://', '');

          // Try with extensions first
          const resolvedPath = tryExtensions(fileName);
          if (resolvedPath) {
            return {
              url: `file://${resolvedPath}`,
              format: 'module',
              shortCircuit: true,
            };
          }

          // If file exists as-is
          if (existsSync(fileName)) {
            return {
              url: `file://${fileName}`,
              format: 'module',
              shortCircuit: true,
            };
          }

          // Last resort: try require.resolve for node_modules
          try {
            return {
              url: `file://${require.resolve(fileName)}`,
              format: 'module',
              shortCircuit: true,
            };
          } catch {
            return {
              url: `file://${fileName}`,
              format: 'module',
              shortCircuit: true,
            };
          }
        }
      );
      return {
        id: r.url.replace('file://', ''),
      };
    },
  };
}

/**
 * Create a transformRequest function for HMR
 */
export function createTransformRequest(
  loadFunction: any,
  resolveFunction: any,
  packageName: string,
  log: (msg: string) => void = () => {}
) {
  return async (filename: string) => {
    log(`[TRANSFORM_REQUEST] Called with filename: ${filename}`);

    if (filename.startsWith(packageName)) {
      filename = filename.replace(packageName, 'app');
      log(`[TRANSFORM_REQUEST] Replaced pkg.name, now: ${filename}`);
    }

    // Ensure filename is an absolute path
    let absolutePath = filename;
    if (!filename.startsWith('/') && !filename.startsWith('file://')) {
      if (filename.startsWith('app')) {
        absolutePath = path.resolve(process.cwd(), filename);
      } else {
        try {
          absolutePath = require.resolve(filename);
        } catch {
          // pass
        }
      }
      log(`[TRANSFORM_REQUEST] Resolved to absolute: ${absolutePath}`);
    }

    // Ensure it's a file:// URL for load()
    const fileUrl = absolutePath.startsWith('file://')
      ? absolutePath
      : `file://${absolutePath}`;
    log(`[TRANSFORM_REQUEST] Using file URL: ${fileUrl}`);

    const context = {
      parentURL: `file://${process.cwd()}`,
      resolve: async (id: string, importer?: string) => {
        try {
          const resolved = await resolveFunction(
            id,
            { parentURL: importer || `file://${process.cwd()}` },
            (spec: string) => {
              return { url: `file://${spec}`, format: 'module' };
            }
          );
          return resolved;
        } catch {
          return null;
        }
      },
    };

    const l = await loadFunction(fileUrl, context, (url: string) => {
      try {
        const filePath = url.startsWith('file://') ? fileURLToPath(url) : url;
        log(`[TRANSFORM_REQUEST] nextLoad trying: ${filePath}`);
        if (existsSync(filePath) && statSync(filePath).isFile()) {
          const source = readFileSync(filePath).toString();
          log(`[TRANSFORM_REQUEST] nextLoad success, source length: ${source.length}`);
          return { source };
        }
      } catch (e: any) {
        log(`[TRANSFORM_REQUEST] nextLoad error: ${e.message}`);
      }
      return null;
    });

    if (!l) {
      log(`[TRANSFORM_REQUEST] load() returned null for ${fileUrl}`);
      console.error('failed to load', filename);
      return null;
    }

    log(`[TRANSFORM_REQUEST] Success! Returning code length: ${l.source?.length || 0}`);
    return l ? { code: l.source } : null;
  };
}

/**
 * Normalize file path for consistent handling
 */
export function normalizeFilePath(url: string): string {
  const cleanUrl = url.split('?')[0];
  let filePath = cleanUrl;
  try {
    filePath = fileURLToPath(cleanUrl);
    filePath = realpathSync(filePath);
  } catch {
    // Ignore errors
  }
  return filePath;
}

/**
 * Create HMR context for resolveId
 */
export function createHMRResolveContext(nextResolve: any, context: any) {
  return {
    resolve: async (id: string, importer?: string) => {
      try {
        const resolved = await nextResolve(id, {
          ...context,
          parentURL: importer ? `file://${importer}` : context.parentURL,
          conditions: ['import', 'node', 'module-sync', 'node-addons'],
        });
        return {
          id: resolved.url.replace('file://', ''),
        };
      } catch {
        return null;
      }
    }
  };
}

/**
 * Handle relative imports with extension resolution
 */
export function handleRelativeImports(
  context: any,
  resolvedSpecifier: string,
  pathPattern: string,
  extensions?: string[]
): { url: string; format: string; shortCircuit: boolean } | null {
  if (context.parentURL && context.parentURL.includes(pathPattern) && resolvedSpecifier.startsWith('.')) {
    const parentPath = fileURLToPath(context.parentURL);
    const parentDir = path.dirname(parentPath);
    const fullPath = path.resolve(parentDir, resolvedSpecifier);

    const resolvedPath = tryExtensions(fullPath, extensions);
    if (resolvedPath) {
      return {
        url: `file://${resolvedPath}`,
        format: 'module',
        shortCircuit: true,
      };
    }
  }
  return null;
}

/**
 * Create a minimal resolve function with customizable hooks
 */
export function createResolveFunction(options: {
  plugins: Array<any>;
  resolverLoader: any;
  log?: (msg: string) => void;
  customResolvers?: Array<(specifier: string, context: any, nextResolve: any) => Promise<any>>;
}) {
  const { plugins, resolverLoader, log = () => {}, customResolvers = [] } = options;

  return async function resolve(specifier: string, context: any, nextResolve: any) {
    log(`[RESOLVE] ${specifier}`);

    // Normalize app paths
    if (specifier.startsWith('app')) {
      specifier = path.join(process.cwd(), './' + specifier);
    }

    try {
      // Strip query parameters for HMR cache busting
      if (specifier.includes('?t=')) {
        specifier = specifier.replace('file://', '');
        if (specifier.startsWith('app')) {
          specifier = path.join(process.cwd(), './' + specifier);
        }
        return {
          url: `file://${specifier}`,
          format: 'module',
          shortCircuit: true,
        };
      }

      const cleanSpecifier = specifier;

      // Built-in Node.js modules
      if (cleanSpecifier.startsWith('node:')) {
        return nextResolve(cleanSpecifier, context);
      }

      // Embroider implicit modules
      if (cleanSpecifier.endsWith('-embroider-implicit-modules.js')) {
        return {
          url: `file://${cleanSpecifier}`,
          format: 'module',
          shortCircuit: true,
        };
      }

      // Content-for.json
      let resolvedSpecifier = cleanSpecifier;
      if (cleanSpecifier.includes('.embroider/content-for.json')) {
        resolvedSpecifier = path.resolve(process.cwd(), 'node_modules', cleanSpecifier);
        return {
          url: `file://${resolvedSpecifier}`,
          format: 'module',
          shortCircuit: true,
        };
      }

      // Force emoji-regex to use ESM
      if (resolvedSpecifier === 'emoji-regex') {
        const resolved = await nextResolve(resolvedSpecifier, {
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

      // Try custom resolvers
      for (const customResolver of customResolvers) {
        const result = await customResolver(resolvedSpecifier, context, nextResolve);
        if (result) return result;
      }

      // Try plugins in order
      for (const plugin of plugins) {
        if (plugin.resolveId) {
          let pluginContext;

          // Create appropriate context based on plugin type
          if (plugin.name === 'hmr' || typeof plugin.resolveId === 'function') {
            pluginContext = createHMRResolveContext(nextResolve, context);
          } else {
            pluginContext = createEmberResolverContext(nextResolve);
          }

          try {
            const res = await plugin.resolveId.call(
              pluginContext,
              resolvedSpecifier,
              context.parentURL?.replace('file://', '') || path.resolve('./package.json'),
              {}
            );

            if (res) {
              // Handle HMR plugin response
              if (res.id || typeof res === 'string') {
                return {
                  url: `file://${res.id || res}`,
                  format: 'module',
                  shortCircuit: true,
                };
              }

              // Handle Ember resolver response
              if (res?.id?.includes('-embroider')) {
                return {
                  url: `file://${res.id}`,
                  format: 'module',
                  shortCircuit: true,
                };
              }

              if (res?.id && (res.id.includes('app') || res.id.includes('node_modules'))) {
                const r = await nextResolve(res.id, {
                  ...context,
                  conditions: ['import', 'module', 'node', 'commonjs'],
                });
                const f = r.url.replace('file://', '');
                const pkg = resolverLoader.resolver.packageCache.ownerOfFile(f);
                const isEmber = pkg?.isEmberAddon() || pkg?.packageJSON.ember;
                const isWarpDrive = f.includes('/@warp-drive/');

                // Force module format for ember addons EXCEPT @warp-drive packages
                if (isEmber && !isWarpDrive) {
                  r.format = 'module';
                }
                r.shortCircuit = true;
                return r;
              }
            }
          } catch {
            // Continue to next plugin
          }
        }
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
  };
}

/**
 * Create a minimal load function with customizable hooks
 */
export function createLoadFunction(options: {
  plugins: Array<any>;
  resolveFunction: any;
  packageName?: string;
  log?: (msg: string) => void;
  shouldSkip?: (url: string) => boolean;
}) {
  const {
    plugins,
    resolveFunction,
    packageName,
    log = () => {},
    shouldSkip = () => false,
  } = options;


  const loadFunction = async function load(url: string, context: any, nextLoad: any) {
    log(`[LOAD] ${url}`);

    const cleanUrl = url.split('?')[0];

    // Skip built-in Node.js modules
    if (cleanUrl.startsWith('node:')) {
      return {
        format: 'builtin',
        source: null,
        shortCircuit: true,
      };
    }

    // Custom skip logic
    if (shouldSkip(cleanUrl)) {
      return nextLoad(cleanUrl, context);
    }

    // Embroider implicit modules
    if (cleanUrl.endsWith('-embroider-implicit-modules.js')) {
      return {
        format: 'module',
        source: 'export default {}',
        shortCircuit: true,
      };
    }

    const filePath = normalizeFilePath(cleanUrl);
    const transformContext = createTransformContext(resolveFunction);

    let content = '';

    // Try plugins' load methods in order
    for (const plugin of plugins) {
      if (plugin.load) {
        log(`plugin load: ${plugin.name}`);
        const result = await plugin.load.call(transformContext, filePath);
        if (result) {
          content = result;
          break;
        }
      }
    }

    if (!content) {
      if (existsSync(filePath) && statSync(filePath).isFile()) {
        content = readFileSync(filePath).toString();
      } else {
        return nextLoad(url, context);
      }
    }

    // Handle JSON files
    if (cleanUrl.endsWith('.json')) {
      return {
        format: 'module',
        source: 'export default ' + content,
        shortCircuit: true,
      };
    }

    // Apply plugin transforms in order
    for (const plugin of plugins) {
      if (plugin.transform) {
        log(`plugin transform: ${plugin.name}`);
        try {
          if (plugin.transform?.handler) {
            const result = await plugin.transform?.handler(content, filePath);
            if (result?.code) {
              content = result.code;
            }
            continue;
          }
          if (plugin.transform) {
            const result = await plugin.transform?.(content, filePath);
            log(`plugin ${plugin.name} transform result: ${result.code}`);
            if (result?.code) {
              content = result.code;
            }
          }
        } catch (e) {
          log(`Transform error in plugin: ${e}`);
          console.error(`Transform error in plugin:`, e);
        }
      }
    }

    log(`[LOAD] shouldTransform ${filePath} ${shouldTransformFile(filePath)}`);
    if (!shouldTransformFile(filePath)) {
      return nextLoad(cleanUrl, context);
    }



    return {
      format: 'module',
      source: content,
      shortCircuit: true,
    };
  };

  // Auto-configure HMR plugin if present and packageName is provided
  if (packageName) {
    const hmrPlugin = plugins.find(p => p.name === 'hmr' || p.configureServer);
    if (hmrPlugin?.configureServer) {
      const transformRequestFn = createTransformRequest(loadFunction, resolveFunction, packageName, log);
      hmrPlugin.configureServer({
        transformRequest: transformRequestFn,
      });
    }
  }

  return loadFunction;
}
