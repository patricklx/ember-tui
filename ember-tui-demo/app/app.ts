import EmberApplication from '@ember/application';
// @ts-expect-error - ember-resolver types not properly exported
import Resolver from 'ember-resolver/index.js';
import ENV from './config/env';
import compatModules from '@embroider/virtual/compat-modules';
import ApplicationInstance from "@ember/application/instance";

// Set up Ember globals
if (typeof window !== 'undefined') {
  window.EmberENV = ENV.EmberENV;
}



export default class App extends EmberApplication {
  rootElement = ENV.rootElement;
  autoboot = ENV.autoboot;
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

