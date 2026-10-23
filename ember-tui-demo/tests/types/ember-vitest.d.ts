// Override ember-vitest types: in ember-tui the rendering element is a terminal
// ElementNode, not the HTMLDivElement ember-vitest declares.
import type ElementNode from 'ember-tui/dom/nodes/ElementNode';

interface TerminalRenderingContext {
  render(template: any): Promise<void>;
  element: ElementNode & {
    querySelector(selector: string): any;
    textContent: string;
  };
}

// ember-vitest's index only re-exports, so the declaring module is augmented.
declare module 'ember-vitest/manual' {
  export function setupRenderingContext(app: any): Promise<TerminalRenderingContext & AsyncDisposable>;
}

// Override render function to accept any
declare module 'ember-tui' {
  export function render(rootNode: any): void;
}
