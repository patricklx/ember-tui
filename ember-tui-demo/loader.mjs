import { appendFileSync } from 'fs';
import babelConfig from './babel.config.mjs';
import pkg from './package.json' with { type: 'json' };
import {
  createResolveFunction,
  createLoadFunction,
} from 'ember-tui/loader-utils';
import {
  createDefaultPlugins,
} from 'ember-tui/loader-plugins';

// Debug logging to file
const logFile = 'log.txt';
const log = (msg) => process.env.LOADER_DEBUG && appendFileSync(logFile, `${new Date().toISOString()} ${msg}\n`);
log('[LOADER] Initializing loader.mjs');

// Create plugins (includes babel plugin)
const { hmrPlugin, emberResolver, emberTemplateTag, babelPlugin, resolverLoader } = createDefaultPlugins(process.cwd(), babelConfig);
const plugins = [babelPlugin, hmrPlugin, emberResolver, emberTemplateTag];
log('[LOADER] Plugins initialized');

// Enable HMR
process.env['EMBER_VITE_HMR_ENABLED'] = 'true';

// Error handling
process.on('uncaughtException', function (err) {
  console.error((new Date).toUTCString() + ' uncaughtException:', err.message)
  console.error(err.stack)
  process.exit(1)
});

// Create resolve function with plugins
export const resolve = createResolveFunction({
  plugins,
  resolverLoader,
  log,
});

// Create load function with plugins (auto-configures HMR)
export const load = createLoadFunction({
  plugins,
  resolveFunction: resolve,
  packageName: pkg.name,
  log,
  shouldSkip: () => {
    // Don't intercept bob-harness or bob-agent
  },
});
