/**
 * Plugin wrappers for Node.js loader customization
 * These functions create and configure the necessary plugins for Ember TUI apps
 */

import { hmr } from 'ember-vite-hmr';
import { resolver, templateTag } from '@embroider/vite';
import { ResolverLoader } from '@embroider/core';
import { transformAsync } from '@babel/core';

/**
 * Transform code using Babel with the provided configuration
 */
async function transformCode(
  content: string,
  filePath: string,
  babelConfig: any,
  transformingFiles: Set<string>
): Promise<string | null> {
  // Check if we're already transforming this file (circular dependency)
  if (transformingFiles.has(filePath)) {
    return content;
  }

  try {
    transformingFiles.add(filePath);

    const result = await transformAsync(content, {
      ...babelConfig,
      babelrc: false,
      configFile: false,
      filename: filePath,
      sourceMaps: 'inline',
    });

    return result?.code || null;
  } catch (e) {
    console.error('Transform error for', filePath, ':', e);
    throw e;
  } finally {
    transformingFiles.delete(filePath);
  }
}

/**
 * Create HMR plugin
 */
export function createHMRPlugin() {
  return hmr();
}

/**
 * Create Ember resolver plugin
 */
export function createEmberResolverPlugin() {
  return resolver();
}

/**
 * Create Ember template tag plugin
 */
export function createEmberTemplateTagPlugin() {
  return templateTag();
}

/**
 * Create Babel transform plugin
 */
export function createBabelPlugin(babelConfig: any) {
  const transformingFiles = new Set<string>();

  return {
    name: 'babel',
    async transform(code: string, id: string) {
      try {
        const transformedCode = await transformCode(code, id, babelConfig, transformingFiles);
        if (transformedCode) {
          return { code: transformedCode };
        }
      } catch (e) {
        console.error('Babel transform error:', e);
      }
      return null;
    },
  };
}

/**
 * Create resolver loader instance
 */
export function createResolverLoader(cwd: string = process.cwd()): ResolverLoader {
  return new ResolverLoader(cwd);
}

/**
 * Create all default plugins for Ember TUI
 * Returns an object with all the plugins needed for the loader
 */
export function createDefaultPlugins(cwd: string = process.cwd(), babelConfig?: any) {
  const plugins: any = {
    hmrPlugin: createHMRPlugin(),
    emberResolver: createEmberResolverPlugin(),
    emberTemplateTag: createEmberTemplateTagPlugin(),
    resolverLoader: createResolverLoader(cwd),
  };

  if (babelConfig) {
    plugins.babelPlugin = createBabelPlugin(babelConfig);
  }

  return plugins;
}
