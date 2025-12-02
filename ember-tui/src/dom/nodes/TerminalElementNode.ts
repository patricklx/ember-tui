import type { Node as YogaNode } from 'yoga-layout';
import ElementNode from "./ElementNode";

export type TerminalStyles = {
  // Text styles
  color?: string;
  backgroundColor?: string;
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
  strikethrough?: boolean;
  dimColor?: boolean;
  inverse?: boolean;
  textWrap?: 'wrap' | 'truncate' | 'truncate-start' | 'truncate-middle' | 'truncate-end';

  // Layout styles (Flexbox)
  flexDirection?: 'row' | 'row-reverse' | 'column' | 'column-reverse';
  flexWrap?: 'nowrap' | 'wrap' | 'wrap-reverse';
  flexGrow?: number;
  flexShrink?: number;
  flexBasis?: number | string;
  alignItems?: 'flex-start' | 'center' | 'flex-end' | 'stretch';
  alignSelf?: 'auto' | 'flex-start' | 'center' | 'flex-end' | 'stretch';
  justifyContent?: 'flex-start' | 'center' | 'flex-end' | 'space-between' | 'space-around' | 'space-evenly';

  // Dimensions
  width?: number | string;
  height?: number | string;
  minWidth?: number;
  minHeight?: number;

  // Spacing
  padding?: number;
  paddingX?: number;
  paddingY?: number;
  paddingTop?: number;
  paddingBottom?: number;
  paddingLeft?: number;
  paddingRight?: number;
  margin?: number;
  marginX?: number;
  marginY?: number;
  marginTop?: number;
  marginBottom?: number;
  marginLeft?: number;
  marginRight?: number;

  // Gap
  gap?: number;
  columnGap?: number;
  rowGap?: number;

  // Visibility
  display?: 'flex' | 'none';
  overflow?: 'visible' | 'hidden';
  overflowX?: 'visible' | 'hidden';
  overflowY?: 'visible' | 'hidden';

  // Borders
  borderStyle?: 'single' | 'double' | 'round' | 'bold' | 'singleDouble' | 'doubleSingle' | 'classic';
  borderColor?: string;
  borderTopColor?: string;
  borderRightColor?: string;
  borderBottomColor?: string;
  borderLeftColor?: string;
  borderDimColor?: boolean;
  borderTopDimColor?: boolean;
  borderRightDimColor?: boolean;
  borderBottomDimColor?: boolean;
  borderLeftDimColor?: boolean;
  borderTop?: boolean;
  borderRight?: boolean;
  borderBottom?: boolean;
  borderLeft?: boolean;
};

export type OutputTransformer = (text: string) => string;

/**
 * Element node for terminal rendering
 * Represents a styled container or text element
 */
export default class TerminalElementNode extends ElementNode {
  style: TerminalStyles = {};
  declare yogaNode?: YogaNode;
  declare internal_transform?: OutputTransformer;
  internal_static?: boolean;

  // For root node
  isStaticDirty?: boolean;
  staticNode?: TerminalElementNode;
  onComputeLayout?: () => void;
  onRender?: () => void;
  onImmediateRender?: () => void;

  constructor(tagName: string) {
    super(tagName);
    this.nodeType = 1;
  }

  /**
   * Set style properties
   */
  setStyle(style: TerminalStyles): void {
    this.style = { ...this.style, ...style };
  }

  /**
   * Get computed style value
   */
  getStyle(property: keyof TerminalStyles): any {
    return this.style[property];
  }

  /**
   * Set transform function for text output
   */
  setTransform(transform: OutputTransformer): void {
    this.internal_transform = transform;
  }

  /**
   * Mark as static content
   */
  setStatic(isStatic: boolean): void {
    this.internal_static = isStatic;
  }

  /**
   * String representation
   */
  toString(): string {
    return `<${this.tagName}>`;
  }
}
