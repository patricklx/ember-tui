import type { TemplateOnlyComponent } from '@ember/component/template-only';
import type ElementNode from 'ember-tui/dom/nodes/ElementNode';

declare module 'ember-vitest' {
  export interface RenderingContext {
    render(template: TemplateOnlyComponent): Promise<void>;
    element: ElementNode;
  }

  export function setupRenderingContext(app: any): Promise<RenderingContext & AsyncDisposable>;
}

declare module 'ember-tui' {
  export function render(element: ElementNode | Element, options?: any): void;
}

declare module 'ember-tui/components/Text.gts' {
  import Component from '@glimmer/component';
  import type ElementNode from 'ember-tui/dom/nodes/ElementNode';

  interface TextSignature {
    Args: {
      color?: string | undefined;
      backgroundColor?: string | undefined;
      dimColor?: boolean | undefined;
      bold?: boolean | undefined;
      italic?: boolean | undefined;
      underline?: boolean | undefined;
      strikethrough?: boolean | undefined;
      inverse?: boolean | undefined;
      preFormatted?: boolean | undefined;
      wrap?: 'wrap' | 'truncate' | 'truncate-start' | 'truncate-middle' | 'truncate-end' | undefined;
    };
    Blocks: {
      default: [];
    };
    Element: ElementNode;
  }

  export default class Text extends Component<TextSignature> {}
}