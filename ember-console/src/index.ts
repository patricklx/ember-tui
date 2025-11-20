/**
 * Ember-Ink - Terminal UI library for Ember.js
 * Inspired by Ink (React for CLIs)
 */

// Export setup and render
export { setup } from './setup.js';
export { render } from './render.js';
export type { RenderOptions, RenderInstance } from './render.js';

export { default as Text } from './components/Text.gts';
// Note: Text component will be exported once Glimmer VM integration is complete
