/**
 * Ember-Ink - Terminal UI library for Ember.js
 * Inspired by Ink (React for CLIs)
 */

// Export setup and render
export { setup } from './setup';
export { startRender } from './startRender';
export { render, hideCursor, showCursor, handleResize, cursorTo, clearScreen } from './render/apply-term-updates';

export { default as DocumentNode } from './dom/nodes/DocumentNode';
export { default as Text } from './components/Text.gts';
export { default as Box } from './components/Box.gts';
export { default as Transform } from './components/Transform.gts';
export { default as Newline } from './components/Newline.gts';
export { default as Spacer } from './components/Spacer.gts';
export { default as Static } from './components/Static.gts';

export {
  createHotContext,
  getModuleCallbacks,
  handleModuleUpdate,
  normalizeModuleId,
  resolveDepPath,
} from './hmr';
export { createHotContextInjectionPlugin } from './hmr-babel';
export { FileWatcher, startFileWatcher, stopFileWatcher } from './file-watcher';
export { initializeHMR } from './hmr-init';

// Loader utilities for Node.js loader customization
export {
  tryExtensions,
  createEmberResolverContext,
  transformCode,
  shouldTransformFile,
  createTransformContext,
  createTransformRequest,
  normalizeFilePath,
} from './loader-utils';

// Test utilities
export { FakeTTY } from './test-utils/FakeTTY';
export { resetStaticCache } from './render/collect-lines';