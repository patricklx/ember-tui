import type DocumentNode from './DocumentNode';
import {type Node as YogaNode} from 'yoga-layout';
import { getViewMeta } from "../view-meta";
import { registerListenerNode, unregisterListenerNode } from '../../input/listener-nodes';

function* elementIterator(el: any): Generator<any, void, unknown> {
  yield el;
  for (const child of el.childNodes) {
    yield* elementIterator(child);
  }
}

export type EventListener = (args: any) => void;

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export default class ViewNode<Attributes = any> {
  attributesObject: any = {};
  args: any;
  template: any;

  nodeType: any;
  _tagName: any;
  declare parentNode: ViewNode | null;
  childNodes: ViewNode[];
  _ownerDocument: any;
  _meta: any;

  // Properties used by layout and rendering
  yogaNode?: YogaNode;
  staticRendered?: boolean;
  page?: any;
  location?: any;

  get textContent(): string {
    const contents = [];
    // Collect text from direct children only
    for (const child of this.childNodes) {
      if ((child as any).text) {
        // TerminaTextElement or TextNode with text property
        contents.push((child as any).text);
      } else if ((child as any).html) {
        contents.push((child as any).html);
      } else if (child.textContent) {
        // Recursively get text from child elements
        contents.push(child.textContent);
      }
    }
    return contents.filter((c) => !!c).join('').trim();
  }

  getElementById(id: string) {
    for (const el of elementIterator(this)) {
      if (el.nodeType === 1 && el.id === id) return el;
    }
  }

  getElementByClass(klass: string) {
    for (const el of elementIterator(this)) {
      if (el.nodeType === 1 && el.classList.contains(klass)) return el;
    }
  }

  getElementByTagName(tagName: string) {
    for (const el of elementIterator(this)) {
      if (el.nodeType === 1 && el.tagName === tagName) return el;
    }
  }

  querySelector(selector: string) {
    if (selector.startsWith('.')) {
      return this.getElementByClass(selector.slice(1));
    }

    if (selector.startsWith('#')) {
      return this.getElementById(selector.slice(1));
    }

    return this.getElementByTagName(selector);
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  contains(_otherElement: ViewNode) {
    return false;
  }

  constructor() {
    this.nodeType = null;
    this._tagName = this.constructor.name;
    this.parentNode = null;
    this.childNodes = [];

    this._ownerDocument = null;
    this._meta = null;
  }

  hasAttribute(key: string) {
    return this.attributesObject[key];
  }

  removeAttribute(key: string) {
    delete this.attributesObject[key];
  }

  /* istanbul ignore next */
  toString() {
    return `${this.constructor.name}(${this.tagName})`;
  }

  set tagName(name) {
    this._tagName = name;
  }

  get tagName() {
    return this._tagName;
  }

  get firstChild(): ViewNode | null | undefined {
    return this.childNodes.length ? this.childNodes[0] : null;
  }

  get lastChild(): ViewNode | null | undefined {
    return this.childNodes.length
      ? this.childNodes[this.childNodes.length - 1]
      : null;
  }

  get nextSibling(): ViewNode | null {
    if (!this.parentNode) {
      return null;
    }
    const index = this.parentNode.childNodes.indexOf(this);
    if (index === -1 || index === this.parentNode.childNodes.length - 1) {
      return null;
    }
    return this.parentNode.childNodes[index + 1];
  }

  get prevSibling(): ViewNode | null {
    if (!this.parentNode) {
      return null;
    }
    const index = this.parentNode.childNodes.indexOf(this);
    if (index <= 0) {
      return null;
    }
    return this.parentNode.childNodes[index - 1];
  }

  get meta() {
    if (this._meta) {
      return this._meta;
    }

    return (this._meta = getViewMeta(this.tagName));
  }

  get isConnected(): boolean {
    return Boolean(this.ownerDocument);
  }

  /* istanbul ignore next */
  get ownerDocument(): DocumentNode | null {
    let el = this;
    while (el != null && el.nodeType !== 9) {
      el = el.parentNode || el._ownerDocument;
    }

    if (el?.nodeType === 9) {
      return el as unknown as DocumentNode;
    }

    return null;
  }

  get attributes(): any {
    return Object.entries(this.attributesObject).map(([key, value]) => ({
      nodeName: key,
      nodeValue: value,
    }));
  }

  getAttribute(key: string) {
    return this[key as keyof this];
  }

  /* istanbul ignore next */
  setAttribute(key: string, value: any) {
    this.attributesObject[key] = value;
	  this[key as keyof this] = value;
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  onInsertedChild(_childNode: ViewNode, _index: number) {}

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  onRemovedChild(_childNode: ViewNode) {}

  insertBefore(childNode: ViewNode, referenceNode: ViewNode) {
    if (!childNode) {
      throw new Error(`Can't insert child.`);
    }

    // in some rare cases insertBefore is called with a null referenceNode
    // this makes sure that it get's appended as the last child
    if (!referenceNode) {
      return this.appendChild(childNode);
    }

    if (referenceNode.parentNode !== this) {
      throw new Error(
        `Can't insert child, because the reference node has a different parent.`,
      );
    }

    if (childNode.parentNode && childNode.parentNode !== this) {
      throw new Error(
        `Can't insert child, because it already has a different parent.`,
      );
    }

    if (childNode.parentNode === this) {
      // we don't need to throw an error here, because it is a valid case
      // for example when switching the order of elements in the tree
      // fixes #127 - see for more details
      // fixes #240
      // throw new Error(`Can't insert child, because it is already a child.`)
      this.removeChild(childNode);
    }

    const index = this.childNodes.indexOf(referenceNode);

    this.childNodes.splice(index, 0, childNode);
    childNode.parentNode = this;

    this.onInsertedChild(childNode, index);
  }

  appendChild(childNode: ViewNode) {
    if (!childNode) {
      throw new Error(`Can't append null child.`);
    }

    if (childNode.parentNode && childNode.parentNode !== this) {
      throw new Error(
        `Can't append child, because it already has a different parent.`,
      );
    }

    if (childNode.parentNode === this) {
      // we don't need to throw an error here, because it is a valid case
      // for example when switching the order of elements in the tree
      // fixes #127 - see for more details
      // fixes #240
      // throw new Error(`Can't append child, because it is already a child.`)
      return;
    }

    if (this.childNodes.includes(childNode)) {
      throw new Error('already added child.');
    }

    this.childNodes.push(childNode);
    childNode.parentNode = this;

    this.onInsertedChild(childNode, this.childNodes.length - 1);
  }

  removeChild(childNode: ViewNode) {
    if (!childNode) {
      throw new Error(`Can't remove <null> child.`);
    }

    if (!childNode.parentNode) {
      throw new Error(`Can't remove child, because it has no parent.`);
    }

    if (childNode.parentNode !== this) {
      throw new Error(`Can't remove child, because it has a different parent.`);
    }

    if (!this.childNodes.includes(childNode)) {
      throw new Error(`Can't remove child, because its already removed`);
    }

    childNode.parentNode = null;


    this.childNodes = this.childNodes.filter((node) => node !== childNode);
    this.onRemovedChild(childNode);
  }

  clear(node: any) {
    while (node.childNodes.length) {
      this.clear(node.firstChild);
    }
    node.parentNode.removeChild(node);
  }

  removeChildren() {
    while (this.childNodes.length) {
      this.clear(this.firstChild);
    }
  }

  firstElement() {
    for (const child of this.childNodes) {
      if (child.nodeType == 1) {
        return child;
      }
    }
    return null;
  }

  // ---------------------------------------------------------------------------
  // Generic event listeners (supports any event type)
  // ---------------------------------------------------------------------------

  private _eventListeners?: Map<string, EventListener[]>;
  private _hasRegisteredWithInputSystem = false;

  addEventListener(type: string, callback: EventListener): void {
    // Initialize the event listeners map if it doesn't exist
    if (!this._eventListeners) this._eventListeners = new Map();
    if (!this._eventListeners.has(type)) this._eventListeners.set(type, []);
    this._eventListeners.get(type)!.push(callback);

    // Register with input system when first listener is added
    if (!this._hasRegisteredWithInputSystem) {
      registerListenerNode(this);
      this._hasRegisteredWithInputSystem = true;
    }
  }

  removeEventListener(type: string, callback: EventListener): void {
    const list = this._eventListeners?.get(type);
    if (!list) return;

    const idx = list.indexOf(callback);
    if (idx === -1) return;

    list.splice(idx, 1);
    if (list.length === 0) this._eventListeners!.delete(type);

    // Unregister from input system when all listeners are removed
    if (this._hasRegisteredWithInputSystem && this._eventListeners!.size === 0) {
      unregisterListenerNode(this);
      this._hasRegisteredWithInputSystem = false;
    }
  }

  dispatchNodeEvent(event: any): void {
    const list = this._eventListeners?.get(event.type);
    if (list) {
      for (const cb of [...list]) cb(event);
    }
  }

  getBoundingClientRect(): {
    left: number;
    top: number;
    bottom: number;
    width: number;
    height: number;
  } | null {
    if (this.yogaNode) {
      let left = 0;
      let top = 0;

      // Traverse up the parent chain to calculate absolute position
      let current = this.yogaNode as typeof this.yogaNode | null;
      while (current) {
        const layout = current.getComputedLayout();
        left += layout.left;
        top += layout.top;
        current = current.getParent();
      }

      const layout = this.yogaNode.getComputedLayout();

      return {
        left: left,
        top: top,
        bottom: top + layout.height,
        width: layout.width,
        height: layout.height
      };
    }
    return null;
  }

	remove() {
		this.parentNode?.removeChild(this);
	}
}
