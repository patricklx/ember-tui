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

export default class Box extends Component<BoxSignature> {

  get attrs() {
    return Object.assign({}, this.args);
  }

  <template>
    {{! @glint-ignore }}
    <terminal-box __attrs__={{this.attrs}} ...attributes>{{yield}}</terminal-box>
  </template>
}
