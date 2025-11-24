/**
 * Ember-Ink - Terminal UI library for Ember.js
 * Inspired by Ink (React for CLIs)
 */

// Export setup and render
export { setup } from './setup.js';
export { startRender } from './startRender';
export { render } from './render/apply-term-updates';

export { default as DocumentNode } from './dom/nodes/DocumentNode';
export { default as Text } from './components/Text.gts';
export { default as Box } from './components/Box.gts';
export { default as Newline } from './components/Newline.gts';
export { default as Spacer } from './components/Spacer.gts';
export { default as Static } from './components/Static.gts';
