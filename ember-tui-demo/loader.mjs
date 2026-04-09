import babelConfig from './babel.config.mjs';
import pkg from './package.json' with { type: 'json' };
import {
  setupErrorHandling,
  createDebugLogger,
  createResolveFunction,
  createLoadFunction,
  configureLoaderHMR,
  createLoaderHelpers,
} from 'ember-tui/loader-utils';

// Setup error handling
setupErrorHandling();

// Create debug logger
const log = createDebugLogger('log.txt');
log('[LOADER] Initializing loader.mjs');

// Create shared loader helpers (plugins and resolver)
const helpers = createLoaderHelpers(true);
log('[LOADER] Plugins initialized');

// Create resolve and load functions with shared helpers
export const resolve = createResolveFunction({
  log,
  helpers,
});

export const load = createLoadFunction({
  babelConfig,
  resolveFunction: resolve,
  log,
  helpers,
});

// Register transformRequest with HMR plugin using shared helpers
configureLoaderHMR({
  loadFunction: load,
  resolveFunction: resolve,
  packageName: pkg.name,
  log,
  helpers,
});
