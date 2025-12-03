import { setup, DocumentNode, startRender } from 'ember-tui';
import App from './app';
import type ApplicationClass from "@ember/application";
import env from "./config/env";

function init(
	Application: typeof ApplicationClass,
	env: any
) {

	env.rootElement = DocumentNode.getInstance().body;

	const app = Application.create() as any;
	app.ENV = env;

	app.register('config:environment', env);

	return app;
}

export async function boot() {
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

export async function startApp() {
  await boot();

  const document = globalThis.document;

	const app = init(App, env)
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
