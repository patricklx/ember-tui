import Component from '@glimmer/component';
import { type Styles } from '../dom/styles';
import type ElementNode from '../dom/nodes/ElementNode';

interface StaticSignature<T> {
  Args: {
		items: T[];
    style?: Partial<Styles>;
  };
  Blocks: {
    default: [item: T, index: number];
  };
  Element: ElementNode;
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
    {{! @glint-nocheck }}
    <terminal-box
      internal_static={{true}}
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
			{{#each @items key="@index" as |item|}}
				{{yield item}}
			{{/each}}
    </terminal-box>
  </template>
}
