import { defineConfig } from 'vitest/config';

export default defineConfig({
  root: '.',
  test: {
    chaiConfig: {
      truncateThreshold: 0
    },
    globals: true,
    environment: 'node',
    alias: {
      '@ember/runloop': new URL('./src/__mocks__/@ember/runloop.ts', import.meta.url).pathname,
    },
  },
});
