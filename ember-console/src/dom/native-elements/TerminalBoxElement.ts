import ElementNode from '../nodes/ElementNode';
import { Styles } from '../styles';
import { LiteralUnion } from 'type-fest';
import { ForegroundColorName } from 'chalk';

interface Attributes {
  /**
   * A label for the element for screen readers.
   */
  readonly 'aria-label'?: string;

  /**
   * Hide the element from screen readers.
   */
  readonly 'aria-hidden'?: boolean;

  /**
   * The role of the element.
   */
  readonly 'aria-role'?: string;

  // Flexbox properties
  readonly 'flex-direction'?: Styles['flexDirection'];
  readonly 'flex-wrap'?: Styles['flexWrap'];
  readonly 'flex-grow'?: Styles['flexGrow'];
  readonly 'flex-shrink'?: Styles['flexShrink'];
  readonly 'flex-basis'?: Styles['flexBasis'];
  readonly 'align-items'?: Styles['alignItems'];
  readonly 'align-self'?: Styles['alignSelf'];
  readonly 'justify-content'?: Styles['justifyContent'];

  // Dimensions
  readonly width?: Styles['width'];
  readonly height?: Styles['height'];
  readonly 'min-width'?: Styles['minWidth'];
  readonly 'min-height'?: Styles['minHeight'];
  readonly 'max-width'?: Styles['maxWidth'];
  readonly 'max-height'?: Styles['maxHeight'];

  // Spacing
  readonly 'padding-top'?: Styles['paddingTop'];
  readonly 'padding-bottom'?: Styles['paddingBottom'];
  readonly 'padding-left'?: Styles['paddingLeft'];
  readonly 'padding-right'?: Styles['paddingRight'];
  readonly 'margin-top'?: Styles['marginTop'];
  readonly 'margin-bottom'?: Styles['marginBottom'];
  readonly 'margin-left'?: Styles['marginLeft'];
  readonly 'margin-right'?: Styles['marginRight'];

  // Gap
  readonly gap?: Styles['gap'];
  readonly 'row-gap'?: Styles['rowGap'];
  readonly 'column-gap'?: Styles['columnGap'];

  // Display
  readonly display?: Styles['display'];

  // Overflow
  readonly overflow?: Styles['overflow'];
  readonly 'overflow-x'?: Styles['overflowX'];
  readonly 'overflow-y'?: Styles['overflowY'];

  // Border
  readonly 'border-style'?: Styles['borderStyle'];
  readonly 'border-color'?: Styles['borderColor'];
  readonly 'border-top-style'?: Styles['borderTopStyle'];
  readonly 'border-bottom-style'?: Styles['borderBottomStyle'];
  readonly 'border-left-style'?: Styles['borderLeftStyle'];
  readonly 'border-right-style'?: Styles['borderRightStyle'];
  readonly 'border-top-color'?: Styles['borderTopColor'];
  readonly 'border-bottom-color'?: Styles['borderBottomColor'];
  readonly 'border-left-color'?: Styles['borderLeftColor'];
  readonly 'border-right-color'?: Styles['borderRightColor'];
  readonly 'border-dim-color'?: Styles['borderDimColor'];
  readonly 'border-top-dim-color'?: Styles['borderTopDimColor'];
  readonly 'border-bottom-dim-color'?: Styles['borderBottomDimColor'];
  readonly 'border-left-dim-color'?: Styles['borderLeftDimColor'];
  readonly 'border-right-dim-color'?: Styles['borderRightDimColor'];

  // Background
  readonly 'background-color'?: LiteralUnion<ForegroundColorName, string>;
}

export class TerminalBoxElement extends ElementNode<Attributes> {

  constructor() {
    super('terminal-box');
    // Set default flexDirection to column for proper vertical stacking
    this.setAttribute('flex-direction', 'column');
  }

  setAttribute(key: string, value: any) {
    super.setAttribute(key, value);

    // Track if this is a static element
    if (key === 'internal_static') {
      this.isStaticElement = value === 'true' || value === true;
    }

    // If backgroundColor is set, propagate it to child text elements
    if (key === 'background-color') {
      this.propagateBackgroundColor(value);
    }
  }

  /**
   * Propagate background color to child text elements
   */
  private propagateBackgroundColor(backgroundColor: string | undefined) {
    for (const child of this.childNodes) {
      if (child instanceof ElementNode && child.tagName === 'terminal-text') {
        child.setAttribute('inheritedBackgroundColor', backgroundColor);
      }
    }
  }

  /**
   * Override appendChild to propagate background color to new children
   * and handle static children
   */
  appendChild(child: any) {
    super.appendChild(child);

    const backgroundColor = this.getAttribute('background-color');
    if (backgroundColor && child instanceof ElementNode && child.tagName === 'terminal-text') {
      child.setAttribute('inheritedBackgroundColor', backgroundColor);
    }

    return child;
  }
}
