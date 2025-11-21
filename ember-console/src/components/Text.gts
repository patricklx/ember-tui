import Component from '@glimmer/component';
import { tracked } from '@glimmer/tracking';
import chalk from 'chalk';

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
    preFormated?: boolean;
    wrap?: 'wrap' | 'truncate' | 'truncate-start' | 'truncate-middle' | 'truncate-end';
  };
  Blocks: {
    default: [];
  };
  Element: HTMLElement;
}

/**
 * Text component for terminal rendering
 * Displays styled text with color, formatting, and wrapping options
 */
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
      pre-formated={{@preFormated}}
      ...attributes
    >{{yield}}</terminal-text>
  </template>
}
