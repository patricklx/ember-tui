import Component from '@glimmer/component';
import type ElementNode from '../dom/nodes/ElementNode';

interface TextSignature {
  Args: {
    color?: string;
    backgroundColor?: string;
    dimColor?: boolean;
    bold?: boolean;
    italic?: boolean;
    underline?: boolean;
    strikethrough?: boolean;
    inverse?: boolean;
		preFormatted?: boolean;
    wrap?: 'wrap' | 'truncate' | 'truncate-start' | 'truncate-middle' | 'truncate-end';
  };
  Blocks: {
    default: [];
  };
  Element: ElementNode;
}


/**
 * Text component for terminal rendering
 * Displays styled text with color, formatting, and wrapping options
 */
// eslint-disable-next-line ember/no-empty-glimmer-component-classes
export default class Text extends Component<TextSignature> {
  <template>
    <terminal-text
      color={{@color}}
      background-color={{@backgroundColor}}
      dim={{@dimColor}}
      bold={{@bold}}
      italic={{@italic}}
      underline={{@underline}}
      strikethrough={{@strikethrough}}
      inverse={{@inverse}}
      wrap={{@wrap}}
      pre-formatted={{@preFormatted}}
      ...attributes
    >{{yield}}</terminal-text>
  </template>
}
