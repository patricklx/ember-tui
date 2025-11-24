import Component from '@glimmer/component';
import { type Styles } from '../dom/styles';

interface StaticSignature<T> {
  Args: {
    style?: Partial<Styles>;
  };
  Blocks: {
    default: [item: T, index: number];
  };
  Element: HTMLElement;
}

/**
 * Static component for terminal rendering
 * Permanently renders its output above everything else.
 * Useful for displaying activity like completed tasks or logs.
 *
 * Note: Static only renders new items in the items array and ignores
 * items that were previously rendered. When you add new items to the
 * items array, changes to previous items will not trigger a rerender.
 */
export default class Static<T> extends Component<StaticSignature<T>> {
  <template>
    <terminal-box
      internal_static="true"
      flex-direction={{if @style.flexDirection @style.flexDirection "column"}}
      width={{@style.width}}
      height={{@style.height}}
      padding-top={{@style.paddingTop}}
      padding-bottom={{@style.paddingBottom}}
      padding-left={{@style.paddingLeft}}
      padding-right={{@style.paddingRight}}
      margin-top={{@style.marginTop}}
      margin-bottom={{@style.marginBottom}}
      margin-left={{@style.marginLeft}}
      margin-right={{@style.marginRight}}
      ...attributes
    >
      {{yield}}
    </terminal-box>
  </template>
}
