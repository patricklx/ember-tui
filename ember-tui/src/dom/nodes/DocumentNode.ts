import CommentNode from './CommentNode';
import ElementNode from './ElementNode';
import TextNode from './TextNode';
import ViewNode, { type EventListener } from './ViewNode';
import { createElement } from '../element-registry';
import { elementIterator } from './element-iterator';
import type { NativeElementsTagNameMap } from '../native-elements-tag-name-map';

// Type alias for elements with nativeView property
type NativeElementNode = ViewNode & { nativeView: any };

class HeadNode extends ElementNode {
  private document: any;
  constructor(tagName: string, document: DocumentNode) {
    super(tagName);
    this.document = document;
  }
	append = this.appendChild.bind(this);
  appendChild(childNode: ViewNode) {
    if (childNode.tagName === 'style') {
      return;
    }
    super.appendChild(childNode);
  }
  insertAdjacentHTML() {
    return null;
  }
  addEventListener() {
    return null;
  }
  removeEventListener() {

  }
}

let document: DocumentNode | null = null;

export default class DocumentNode extends ViewNode {
  head: any;
  config: any;
  declare nodeMap: Map<any, any>;
  body: ElementNode | undefined;
  documentElement = {
    dataset: {},
  };
  private keypressListeners: EventListener[] = [];

  static getInstance() {
    if (!document) {
      document = new DocumentNode();
    }
    return document;
  }

  constructor() {
    if (document) return document;
    super();
    document = this;
    this.tagName = 'docNode';
    this.nodeType = 9;
    this.head = new HeadNode('head', this);
    this.body = new HeadNode('body', this);
    this.appendChild(this.head);
    this.nodeMap = new Map();
  }

  createEvent(eventInterface: string) {
    const event = {
      eventInterface,
      initEvent(type: string, bubbles: boolean, cancelable: boolean) {
        Object.assign(event, {
          type,
          bubbles,
          cancelable,
        });
      },
    };
    return event;
  }

	createElement(tagName: string): ElementNode {
		return createElement(tagName as keyof NativeElementsTagNameMap) as ElementNode;
	}

  createComment(text: string) {
    return new CommentNode(text);
  }

  createTextNode(text: string) {
    return new TextNode(text);
  }

  addEventListener(event: string, callback: EventListener) {
    if (event === 'DOMContentLoaded') {
      setTimeout(callback, 0);
      return;
    }
    if (event === 'keydown') {
      this.keypressListeners.push(callback);
      return;
    }
    console.error('unsupported event on document', event);
  }

  removeEventListener(event: string, handler: EventListener) {
    if (event === 'DOMContentLoaded') {
      return;
    }
    if (event === 'keydown') {
      const index = this.keypressListeners.indexOf(handler);
      if (index > -1) {
        this.keypressListeners.splice(index, 1);
      }
      return;
    }
    console.error('unsupported event on document', event, handler);
  }

  searchDom(node: ViewNode, startNode: ViewNode, endNode: ViewNode) {
    const start = startNode || this.page;
    if (start === node) {
      return true;
    }
    if (node === endNode) {
      return false;
    }
    for (const childNode of start.childNodes) {
      if (this.searchDom(node, childNode, endNode)) {
        return true;
      }
    }
    let sibling: ViewNode | null = node;
    while (sibling) {
      if (this.searchDom(node, sibling, endNode)) {
        return true;
      }
      sibling = sibling.nextSibling;
    }
    return false;
  }

  createRange() {
    const self = this;
    return {
      startNode: null as ViewNode | null,
      endNode: null as ViewNode | null,
      setStartBefore(startNode: ViewNode | null) {
        while (startNode && !(startNode as NativeElementNode).nativeView) {
          startNode = startNode.nextSibling;
        }
        this.startNode = startNode;
      },
      setEndAfter(endNode: ViewNode | null) {
        while (endNode && !(endNode as NativeElementNode).nativeView) {
          endNode = endNode.prevSibling;
        }
        this.endNode = endNode;
      },
      isPointInRange(dom: ViewNode): boolean {
        if (!this.startNode || !this.endNode) return false;
        return self.searchDom(dom, this.startNode, this.endNode);
      },
      getBoundingClientRect() {
        const isNativeElement = (node: ViewNode): node is NativeElementNode => {
          return 'nativeView' in node && node.nativeView !== undefined;
        };
        if (!this.startNode || !isNativeElement(this.startNode)) return null;
        if (!this.startNode?.yogaNode) return null;
        const point = {
          x: this.startNode.yogaNode!.getComputedLeft() || 0,
          y: this.startNode.yogaNode!.getComputedTop() || 0,
        };
        const size = {
          width: this.startNode.yogaNode!.getComputedWidth() || 0,
          height: this.startNode.yogaNode!.getComputedHeight() || 0,
        };
        let x = point.x;
        let y = point.y;
        let width = size.width;
        let height = size.height;
        for (const element of elementIterator(this.startNode)) {
          const layout = element.yogaNode!.getComputedLayout();
          x = Math.min(x, layout.left);
          y = Math.min(y, layout.top);
          width = layout.left + layout.width - x;
          height = layout.top + layout.height - y;
          if (element === this.endNode) {
            break;
          }
        }
        return {
          left: x,
          top: y,
          bottom: y + height,
          width,
          height,
        };
      },
    };
  }

  querySelectorAll(selector: string) {
    if (selector.startsWith('meta')) {
      const config = this.config;
      return {
        getAttribute(): string {
          return JSON.stringify(config);
        },
      };
    }
    return [];
  }

  dispatchEvent(event: any) {
    if (event.type === 'keydown') {
      for (const listener of this.keypressListeners) {
        listener(event);
      }
      return true;
    }
    return false;
  }

  reset() {
    this.keypressListeners = [];
    this.config = undefined;
    this.page = undefined;
    this.location = undefined;
    this.documentElement = {
      dataset: {},
    };

    this.head.removeChildren();
    this.body?.removeChildren();
    this.nodeMap?.clear();
  }
}
