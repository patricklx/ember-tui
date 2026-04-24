import Component from '@glimmer/component';
import { modifier } from 'ember-modifier';
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
  applyStyles = modifier((element: ElementNode) => {
    // Apply all args as attributes on the element
    for (const [key, value] of Object.entries(this.args)) {
      if (value !== undefined && value !== null) {
        // Convert camelCase to kebab-case for attribute names
        const attributeName = key.replace(/[A-Z]/g, (match) => `-${match.toLowerCase()}`);
        element.setAttribute(attributeName, value as any);
      }
    }
  });

  <template>
    <terminal-box {{this.applyStyles}} ...attributes>{{yield}}</terminal-box>
  </template>
}
