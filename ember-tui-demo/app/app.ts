import 'ember-vite-hmr/setup-ember-hmr';
import 'ember-tui/hmr-init';
import EmberApplication from '@ember/application';
import Resolver from 'ember-resolver/index.js';
import ENV from './config/environment.ts';
import compatModules from '@embroider/virtual/compat-modules';
import ApplicationInstance from "@ember/application/instance";
import { setup, DocumentNode, startRender, hideCursor } from 'ember-tui';
import { setupEmberInspector, loadEmberDebug } from 'ember-native-devtools/client';
import setupInspector from '@embroider/legacy-inspector-support/ember-source-4.12';
import loadInitializers from 'ember-load-initializers';

// Set up Ember globals
if (typeof window !== 'undefined') {
  window.EmberENV = ENV.EmberENV;
}

hideCursor();

if (import.meta.hot) {
  let prevCompatModules = Object.assign({}, compatModules) as any;
  import.meta.hot.accept('@embroider/virtual/compat-modules', (m) => {
    if (!m) return;
    const newModule = m as { default: Record<string, any> };
    for (const [name, module] of Object.entries(newModule.default)) {
      if (name.includes('initializers') && prevCompatModules[name]?.default !== module.default) {
        (globalThis as any).app.destroy();
        startApp();
      }
    }
    prevCompatModules = newModule.default;
  });
}

class App extends EmberApplication {
  rootElement = ENV.rootElement;
  autoboot = false;
  modulePrefix = ENV.modulePrefix;
  podModulePrefix = `${ENV.modulePrefix}/pods`;
  Resolver = Resolver.withModules(compatModules);
  inspector = setupInspector(this);

  buildInstance() {
    const instance = super.buildInstance();
    instance.setupRegistry = (options: any) => {
      options.isInteractive = true;
      options.document = globalThis.document;
      ApplicationInstance.prototype.setupRegistry.call(instance, options);
    };
    return instance;
  }
}

loadInitializers(App, ENV.modulePrefix, compatModules);

export default App;

function init(
  Application: typeof EmberApplication,
  env: any
) {
  env.rootElement = DocumentNode.getInstance().body;

  const app = Application.create() as any;
  app.ENV = env;

  app.register('config:environment', env);

  return app;
}

async function boot() {
  return new Promise<void>((resolve, reject) => {
    try {
      // Set up the terminal environment (creates document, window, etc.)
      setup();

      console.error('🚀 Starting ember-tui Application...\n');

      // Resolve immediately - we're ready to visit
      resolve();
    } catch (e) {
      reject(e instanceof Error ? e : new Error(String(e)));
    }
  });
}

async function startApp() {
  await boot();

  const document = globalThis.document;

  const app = init(App, ENV);
  // Visit the static-test route to test Static component
  await app.visit('/', {
    document: document as any,
    isInteractive: true,
  });

  // Make app available globally for debugging
  (globalThis as any).app = app;

  startRender(document as any as DocumentNode);
  setupEmberInspector();
  await loadEmberDebug();

  // Force initial render to complete and flush output
  await new Promise(resolve => setTimeout(resolve, 100));

  return App;
}

// Start the Ember application only if not in test mode
// BUT allow starting when TEST_MODE is set (for spawned test processes)
if (!process.env.VITEST || process.env.TEST_MODE) {
  startApp()
    .then(() => {
      // console.error('[main] App started successfully, entering event loop');
      // Start rendering to terminal
    })
    .catch((error) => {
      console.error('Failed to start ember-tui application:', error);
      process.exit(1);
    });
}