import { setup, DocumentNode, startRender } from 'ember-console';
import App from './app';
import type ApplicationClass from "@ember/application";
import env from "./config/env";

function init(
	Application: typeof ApplicationClass,
	env
) {

	env.rootElement = DocumentNode.getInstance().body;

	const app = Application.create({
		name: env.modulePrefix,
		version: env.APP.version,
		ENV: env
	});

	app.register('config:environment', env);

	return app;
}

export async function boot() {
  return new Promise<void>((resolve, reject) => {
    try {
      // Set up the terminal environment (creates document, window, etc.)
      setup();

      console.log('🚀 Starting ember-console Application...\n');

      // Resolve immediately - we're ready to visit
      resolve();
    } catch (e) {
      reject(e);
    }
  });
}

export async function startApp() {
  await boot();

  const document = globalThis.document;

	const app = init(App, env)
  // Visit the root route
  await app.visit('/', {
    document: document,
    isInteractive: true,
  });

  console.log('\n✨ ember-console application started successfully!');

  // Make app available globally for debugging
  (globalThis as any).app = app;

	startRender(document);
}
