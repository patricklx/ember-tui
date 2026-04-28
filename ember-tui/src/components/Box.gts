import Component from '@glimmer/component';
import { type Styles } from '../dom/styles';
import type ElementNode from '../dom/nodes/ElementNode';

interface BoxSignature {
  Args: Styles;
  Blocks: {
    default: [];
  };
  Element: ElementNode;
}

/**
 * Box component for terminal rendering
 * Provides flexbox layout capabilities similar to div with display: flex
 */
// eslint-disable-next-line ember/no-empty-glimmer-component-classes
export default class Box extends Component<BoxSignature> {
  <template>
    <terminal-box __attrs__={{this.args}} ...attributes>{{yield}}</terminal-box>
  </template>
}
