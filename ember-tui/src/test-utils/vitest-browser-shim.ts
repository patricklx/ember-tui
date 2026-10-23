/**
 * Node replacement for `vitest/browser`.
 *
 * ember-vitest (>= 0.4) imports `vitest/browser` unconditionally, which only
 * works inside vitest's Browser Mode. ember-tui renders into a terminal DOM and
 * runs its tests with `environment: "node"`, so apps alias `vitest/browser` to
 * this module in their vitest config. The alias has to be an absolute path,
 * otherwise embroider rejects it as an undeclared dependency of ember-vitest:
 *
 *   const require = createRequire(import.meta.url);
 *   test: {
 *     alias: { 'vitest/browser': require.resolve('ember-tui/test-utils/vitest-browser-shim') },
 *   }
 *
 * Only the parts of the API that ember-vitest touches are provided.
 * Browser-only features (locators, trace marks, user events) are inert or throw.
 */

interface ShimLocator<T> {
  element(): T;
}

export const server = {
  config: {
    browser: {
      locators: {
        testIdAttribute: 'data-testid',
      },
    },
  },
};

export const page = {
  elementLocator<T>(element: T): ShimLocator<T> {
    return {
      element: () => element,
    };
  },

  // Trace marks only exist in the browser trace view.
  async mark(): Promise<void> {},
};

export const utils = {
  // ember-vitest spreads these onto its rendering context; there are no
  // browser locators in the terminal, so there is nothing to add.
  getElementLocatorSelectors(): Record<string, never> {
    return {};
  },
};

export const userEvent = {
  click(): Promise<void> {
    return Promise.reject(
      new Error(
        'userEvent.click is not available in ember-tui tests: terminal clicks are coordinate based mouse events, dispatch them on the document instead.',
      ),
    );
  },
};
