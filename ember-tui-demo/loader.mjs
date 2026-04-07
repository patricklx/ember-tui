import { appendFileSync } from 'fs';
import babelConfig from './babel.config.mjs';
import { resolver, templateTag } from '@embroider/vite';
import { ResolverLoader } from '@embroider/core';
import { hmr } from 'ember-vite-hmr';
import pkg from './package.json' with { type: 'json' };
import {
  createResolveFunction,
  createLoadFunction,
  createTransformRequest,
} from 'ember-tui/loader-utils';

// Debug logging to file
const logFile = 'log.txt';
const log = (msg) => process.env.LOADER_DEBUG && appendFileSync(logFile, `${new Date().toISOString()} ${msg}\n`);
log('[LOADER] Initializing loader.mjs');

// Initialize plugins
const hmrPlugin = hmr();
const emberResolver = resolver();
const emberTemplateTag = templateTag();
const resolverLoader = new ResolverLoader(process.cwd());

log('[LOADER] HMR plugin initialized');

// Enable HMR
process.env['EMBER_VITE_HMR_ENABLED'] = 'true';

// Error handling
process.on('uncaughtException', function (err) {
  console.error((new Date).toUTCString() + ' uncaughtException:', err.message)
  console.error(err.stack)
  process.exit(1)
});

// Create resolve function with all necessary plugins
export const resolve = createResolveFunction({
  emberResolver,
  hmrPlugin,
  resolverLoader,
  log,
});

// Create load function with all necessary plugins
export const load = createLoadFunction({
  emberResolver,
  emberTemplateTag,
  hmrPlugin,
  babelConfig,
  resolveFunction: resolve,
  log,
  shouldSkip: () => {
    // Don't intercept bob-harness or bob-agent
  },
});

// Register transformRequest with HMR plugin
const transformRequestFn = createTransformRequest(load, resolve, pkg.name, log);
hmrPlugin.configureServer({
  transformRequest: transformRequestFn,
});
