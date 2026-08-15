import "./globalSetup";
import App from '../app/app';
import ENV from '../app/config/environment.ts';
import ApplicationRoute from '../app/routes/application.ts';
import ApplicationController from '../app/controllers/application.ts';
import { describe, test, expect } from "vitest";
import { settled } from "@ember/test-helpers";

describe("application route outlet", () => {
	test("outlet renders nested route content when app/routes/application.ts and app/controllers/application.ts exist", async () => {
		const document = globalThis.document as any;

		const env = { ...ENV, rootElement: document.body };
		const app = App.create({ rootElement: document.body }) as any;
		app.ENV = env;
		app.register('config:environment', env);

		const owner = await app.visit('/', {
			document,
			isInteractive: true,
		});

		// Confirm the resolver actually loaded our explicit route/controller
		// files rather than silently falling back to resolver-generated
		// defaults - otherwise this test wouldn't prove anything.
		expect(owner.lookup('route:application')).toBeInstanceOf(ApplicationRoute);
		expect(owner.lookup('controller:application')).toBeInstanceOf(ApplicationController);

		// Mirror the real user flow: the demo's application template shows a
		// menu until a number key is pressed, at which point it transitions to
		// a nested route whose template renders into {{outlet}}.
		document.dispatchEvent({
			type: 'keydown',
			key: '1',
			code: 'Digit1',
			ctrlKey: false,
			preventDefault: () => {},
			stopPropagation: () => {},
		});
		await settled();

		expect(document.body.textContent).toContain('Colors Demo View');

		await app.destroy();
	});
});
