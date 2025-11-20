import EmberApplication from '@ember/application';
import Resolver from 'ember-resolver';
import ENV from './config/env';
import Router from './router';
import AppTemplate from "./templates/application.gts";
import ApplicationInstance from "@ember/application/instance";

// Set up Ember globals
if (typeof window !== 'undefined') {
  window.EmberENV = ENV.EmberENV;
}

// Simple module registry for routes and services
const modules: Record<string, any> = {};

// Register the router
modules['ember-console-demo/app/router'] = {
  default: Router,
};
modules['ember-console-demo/templates/application'] = {
	default: AppTemplate,
};

export default class App extends EmberApplication {
  rootElement = ENV.rootElement;
  autoboot = ENV.autoboot;
  modulePrefix = ENV.modulePrefix;
  podModulePrefix = `${ENV.modulePrefix}/pods`;
  Resolver = Resolver.withModules(modules);

	buildInstance() {
		const instance = super.buildInstance();
		instance.setupRegistry = (options) => {
			options.isInteractive = true;
			options.document = globalThis.document;
			ApplicationInstance.prototype.setupRegistry.call(instance, options);
		}
		return instance;
	}
}

