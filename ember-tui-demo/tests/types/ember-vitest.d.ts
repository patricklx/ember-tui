// Override ember-vitest types to be more permissive with template literals
import type ElementNode from 'ember-tui/dom/nodes/ElementNode';

declare module 'ember-vitest' {
  export interface RenderingContext {
    render(template: any): Promise<void>;
    element: ElementNode & {
      querySelector(selector: string): any;
      textContent: string;
    };
  }

  export function setupRenderingContext(app: any): Promise<RenderingContext & AsyncDisposable>;
}

// Override render function to accept any
declare module 'ember-tui' {
  export function render(rootNode: any): void;
}
