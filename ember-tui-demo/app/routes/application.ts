import Route from '@ember/routing/route';

export default class ApplicationRoute extends Route {
	// Async model hooks are the most plausible way a custom Route could
	// interact badly with ember-tui's render bootstrap (an extra tick before
	// the transition settles), so this exercises one rather than a no-op
	// hook - see application-route-outlet-test.gts.
	async model() {
		return { ready: await Promise.resolve(true) };
	}
}
