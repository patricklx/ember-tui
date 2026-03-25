import type ElementNode from '../dom/nodes/ElementNode';

declare module 'ember-vitest' {
  export interface RenderingContext {
    render(template: any): Promise<void>;
    element: ElementNode | HTMLDivElement;
  }

  export function setupRenderingContext(app: any): Promise<RenderingContext & AsyncDisposable>;
}
