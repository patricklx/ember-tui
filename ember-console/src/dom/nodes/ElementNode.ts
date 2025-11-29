import PropertyNode from './PropertyNode.ts';
import ViewNode from './ViewNode.ts';
import {type Node as YogaNode} from 'yoga-layout';
import { createYogaNode, updateYogaNodeStyles } from '../layout.ts';
import type {Styles} from '../styles.ts';


export interface IClassList {
  length: number;

  add(...classNames: string[]): void;

  remove(...classNames: string[]): void;

  contains(className: string): boolean;
}

export default class ElementNode<Attributes = any> extends ViewNode<Attributes> {
  declare _classList: IClassList;
  declare _id: string;
  yogaNode?: YogaNode;
	staticRendered?: YogaNode;

  /**
   * Override setAttribute to update Yoga styles when style attributes change
   */
  setAttribute(key: string, value: any): void {
    super.setAttribute(key, value);

    // Update Yoga node if this is a style-related attribute
    if (this.yogaNode && this.isStyleAttribute(key)) {
      const styles: Partial<Styles> = {};
      styles[key as keyof Styles] = value;
      updateYogaNodeStyles(this, styles as Styles);
    }
  }

  /**
   * Check if an attribute affects Yoga layout
   */
  private isStyleAttribute(key: string): boolean {
    const styleAttributes = [
      'flexDirection', 'flexGrow', 'flexShrink', 'flexBasis', 'flexWrap',
      'alignItems', 'alignSelf', 'justifyContent',
      'width', 'height', 'minWidth', 'minHeight',
      'margin', 'marginX', 'marginY', 'marginTop', 'marginBottom', 'marginLeft', 'marginRight',
      'padding', 'paddingX', 'paddingY', 'paddingTop', 'paddingBottom', 'paddingLeft', 'paddingRight',
      'gap', 'columnGap', 'rowGap',
      'position', 'display',
      'borderStyle', 'borderTop', 'borderBottom', 'borderLeft', 'borderRight'
    ];
    return styleAttributes.includes(key);
  }
  static ELEMENT_NODE: number;
  static ATTRIBUTE_NODE: number;
  static TEXT_NODE: number;
  static DOCUMENT_NODE: number;

  static {
    this.ELEMENT_NODE = 1; //Node.ELEMENT_NODE
    this.ATTRIBUTE_NODE = 2; //Node.ATTRIBUTE_NODE
    this.TEXT_NODE = 3; //Node.TEXT_NODE
    this.DOCUMENT_NODE = 9; //Node.DOCUMENT_NODE
  }

  constructor(tagName: string) {
    super();
    this.nodeType = 1;
    this.tagName = tagName;
		this.yogaNode = createYogaNode(this);
  }

  get id() {
    if (this.getAttribute === ElementNode.prototype.getAttribute) {
      return this['_id'];
    }
    return this.getAttribute('id') as typeof this._id;
  }

  set id(v: string) {
    if (this.getAttribute === ElementNode.prototype.getAttribute) {
      this['_id'] = v;
      return;
    }
    this.setAttribute('id', v);
  }

  get classList() {
    if (!this._classList) {
      const getClasses: () => string[] = () =>
        ((this.getAttribute('class') as string) || '')
          .split(/\s+/)
          .filter((k: string) => k != '');

      this._classList = {
        add: (...classNames: string[]) => {
          this.setAttribute(
            'class',
            [...new Set(getClasses().concat(classNames))].join(' '),
          );
        },

        contains(klass: string) {
          return Boolean(getClasses().find((x) => x === klass));
        },

        remove: (...classNames: string[]) => {
          this.setAttribute(
            'class',
            getClasses()
              .filter((i: string) => classNames.indexOf(i) == -1)
              .join(' '),
          );
        },

        get length() {
          return getClasses().length;
        },
      };
    }
    return this._classList;
  }

  appendChild(childNode: ViewNode) {
    super.appendChild(childNode);

    if (childNode.nodeType === 7) {
      (childNode as PropertyNode).setOnNode(this);
    }

    // Update Yoga tree when child is added
    if (childNode.nodeType === 1 && this.yogaNode) {
      const childElement = childNode as ElementNode;
      if (childElement.yogaNode) {
				childElement.yogaNode.getParent()?.removeChild(childElement.yogaNode);
        this.yogaNode.insertChild(childElement.yogaNode, this.childNodes.length - 1);
      }
    }
  }

  insertBefore(childNode: ViewNode, referenceNode: ViewNode) {
    super.insertBefore(childNode, referenceNode);

    if (childNode.nodeType === 7) {
      (childNode as PropertyNode).setOnNode(this);
    }

    // Update Yoga tree when child is inserted
    if (childNode.nodeType === 1 && this.yogaNode) {
      const childElement = childNode as ElementNode;
      const index = this.childNodes.indexOf(childNode);
      if (childElement.yogaNode && index >= 0) {
        this.yogaNode.insertChild(childElement.yogaNode, index);
      }
    }
  }

  removeChild(childNode: ViewNode) {
    // Remove from Yoga tree before removing from DOM
    if (childNode.nodeType === 1 && this.yogaNode) {
      const childElement = childNode as ElementNode;
      if (childElement.yogaNode) {
        this.yogaNode.removeChild(childElement.yogaNode);
      }
    }

    super.removeChild(childNode);

    if (childNode.nodeType === 7) {
      (childNode as PropertyNode).clearOnNode(this);
    }
  }
}
