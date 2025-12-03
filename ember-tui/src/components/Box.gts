import Component from '@glimmer/component';
import { type Styles } from '../dom/styles';
import type ElementNode from '../dom/nodes/ElementNode';

interface BoxSignature {
  Args: {
    // Flexbox properties
    flexDirection?: Styles['flexDirection'];
    flexWrap?: Styles['flexWrap'];
    flexGrow?: Styles['flexGrow'];
    flexShrink?: Styles['flexShrink'];
    flexBasis?: Styles['flexBasis'];
    alignItems?: Styles['alignItems'];
    alignSelf?: Styles['alignSelf'];
    justifyContent?: Styles['justifyContent'];

    // Dimensions
    width?: Styles['width'];
    height?: Styles['height'];
    minWidth?: Styles['minWidth'];
    minHeight?: Styles['minHeight'];
    maxWidth?: Styles['maxWidth'];
    maxHeight?: Styles['maxHeight'];

    // Spacing
    paddingTop?: Styles['paddingTop'];
    paddingBottom?: Styles['paddingBottom'];
    paddingLeft?: Styles['paddingLeft'];
    paddingRight?: Styles['paddingRight'];
    marginTop?: Styles['marginTop'];
    marginBottom?: Styles['marginBottom'];
    marginLeft?: Styles['marginLeft'];
    marginRight?: Styles['marginRight'];

    // Gap
    gap?: Styles['gap'];
    rowGap?: Styles['rowGap'];
    columnGap?: Styles['columnGap'];

    // Display
    display?: Styles['display'];

    // Overflow
		overflow?: Styles['overflow'];
    overflowX?: Styles['overflowX'];
    overflowY?: Styles['overflowY'];

    // Border
    borderStyle?: Styles['borderStyle'];
    borderColor?: Styles['borderColor'];
    borderTopStyle?: Styles['borderTopStyle'];
    borderBottomStyle?: Styles['borderBottomStyle'];
    borderLeftStyle?: Styles['borderLeftStyle'];
    borderRightStyle?: Styles['borderRightStyle'];
    borderTopColor?: Styles['borderTopColor'];
    borderBottomColor?: Styles['borderBottomColor'];
    borderLeftColor?: Styles['borderLeftColor'];
    borderRightColor?: Styles['borderRightColor'];
    borderDimColor?: Styles['borderDimColor'];
    borderTopDimColor?: Styles['borderTopDimColor'];
    borderBottomDimColor?: Styles['borderBottomDimColor'];
    borderLeftDimColor?: Styles['borderLeftDimColor'];
    borderRightDimColor?: Styles['borderRightDimColor'];

    // Background
    backgroundColor?: string;

    // Accessibility
    'aria-label'?: string;
    'aria-hidden'?: boolean;
    'aria-role'?: string;
  };
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
    <terminal-box
      flex-direction={{@flexDirection}}
      flex-wrap={{@flexWrap}}
      flex-grow={{@flexGrow}}
      flex-shrink={{@flexShrink}}
      flex-basis={{@flexBasis}}
      align-items={{@alignItems}}
      align-self={{@alignSelf}}
      justify-content={{@justifyContent}}
      width={{@width}}
      height={{@height}}
      min-width={{@minWidth}}
      min-height={{@minHeight}}
      max-width={{@maxWidth}}
      max-height={{@maxHeight}}
      padding-top={{@paddingTop}}
      padding-bottom={{@paddingBottom}}
      padding-left={{@paddingLeft}}
      padding-right={{@paddingRight}}
      margin-top={{@marginTop}}
      margin-bottom={{@marginBottom}}
      margin-left={{@marginLeft}}
      margin-right={{@marginRight}}
      gap={{@gap}}
      row-gap={{@rowGap}}
      column-gap={{@columnGap}}
      display={{@display}}
      overflow={{@overflow}}
      overflow-x={{@overflowX}}
      overflow-y={{@overflowY}}
      border-style={{@borderStyle}}
      border-color={{@borderColor}}
      border-top-style={{@borderTopStyle}}
      border-bottom-style={{@borderBottomStyle}}
      border-left-style={{@borderLeftStyle}}
      border-right-style={{@borderRightStyle}}
      border-top-color={{@borderTopColor}}
      border-bottom-color={{@borderBottomColor}}
      border-left-color={{@borderLeftColor}}
      border-right-color={{@borderRightColor}}
      border-dim-color={{@borderDimColor}}
      border-top-dim-color={{@borderTopDimColor}}
      border-bottom-dim-color={{@borderBottomDimColor}}
      border-left-dim-color={{@borderLeftDimColor}}
      border-right-dim-color={{@borderRightDimColor}}
      background-color={{@backgroundColor}}
      aria-label={{@aria-label}}
      aria-hidden={{@aria-hidden}}
      aria-role={{@aria-role}}
      ...attributes
    >{{yield}}</terminal-box>
  </template>
}
