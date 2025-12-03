import EmberApplication from '@ember/application';
// @ts-expect-error - ember-resolver types not properly exported
import Resolver from 'ember-resolver/index.js';
import ENV from './config/environment.ts';
import compatModules from '@embroider/virtual/compat-modules';
import ApplicationInstance from "@ember/application/instance";
import { setup, DocumentNode, startRender } from 'ember-tui';

// Set up Ember globals
if (typeof window !== 'undefined') {
  window.EmberENV = ENV.EmberENV;
}

class App extends EmberApplication {
  rootElement = ENV.rootElement;
  autoboot = false;
  modulePrefix = ENV.modulePrefix;
  podModulePrefix = `${ENV.modulePrefix}/pods`;
  Resolver = Resolver.withModules(compatModules);

	buildInstance() {
		const instance = super.buildInstance();
		instance.setupRegistry = (options: any) => {
			options.isInteractive = true;
			options.document = globalThis.document;
			ApplicationInstance.prototype.setupRegistry.call(instance, options);
		}
		return instance;
	}
}

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

      console.log('🚀 Starting ember-tui Application...\n');

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

	const app = init(App, ENV)
  // Visit the static-test route to test Static component
  await app.visit('/static-test', {
    document: document as any,
    isInteractive: true,
  });

  console.log('\n✨ ember-tui application started successfully!');

  // Make app available globally for debugging
  (globalThis as any).app = app;

	startRender(document as any as DocumentNode);
}

// Start the Ember application
startApp()
  .then(() => {
    // Start rendering to terminal
  })
  .catch((error) => {
    console.error('Failed to start ember-tui application:', error);
    process.exit(1);
  });

export default App;
