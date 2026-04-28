import ViewNode from './ViewNode';
import {type Node as YogaNode} from 'yoga-layout';
import type { OutputTransformer } from "./TerminalElementNode";


export interface IClassList {
  length: number;

  add(...classNames: string[]): void;

  remove(...classNames: string[]): void;

  contains(className: string): boolean;
}

export default class ElementNode<Attributes = any> extends ViewNode<Attributes> {
  declare _classList: IClassList;
  declare _id: string;
  declare yogaNode?: YogaNode;
	declare internal_transform?: OutputTransformer;

  /**
   * Convert camelCase to kebab-case
   */
  private camelToKebab(str: string): string {
    return str.replace(/([a-z0-9])([A-Z])/g, '$1-$2').toLowerCase();
  }

  /**
   * Override setAttribute to update Yoga styles when style attributes change
   */
  setAttribute(key: string, value: any): void {
    if (key === '__attrs__') {
      for (const [k, v] of Object.entries(value || {})) {
        // Convert camelCase to kebab-case for attributes
        const kebabKey = this.camelToKebab(k);
        this.setAttribute(kebabKey, v);
      }
      return;
    }
		if (key === 'internal_transform') {
			this.internal_transform = value;
			return;
		}
    super.setAttribute(key, value);
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
}
