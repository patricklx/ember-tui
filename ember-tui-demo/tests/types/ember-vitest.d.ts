// Override ember-vitest types to be more permissive with template literals
declare module 'ember-vitest' {
  export interface RenderingContext {
    render(template: any): Promise<void>;
    element: any;
  }

  export function setupRenderingContext(app: any): Promise<RenderingContext & AsyncDisposable>;
}
