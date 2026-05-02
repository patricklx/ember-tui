/**
 * Test utilities for ember-tui
 */

export { FakeTTY } from './FakeTTY';

// Re-export render and other utilities needed for testing
export { render } from '../render/apply-term-updates';
export { resetStaticCache } from '../render/collect-lines';
export { resetState } from '../render/apply-term-updates';
