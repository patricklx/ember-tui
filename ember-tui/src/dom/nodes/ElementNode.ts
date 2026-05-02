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
	
	// Dirty tracking for performance optimization
	// Public with underscore prefix to allow test access
	_isDirty: boolean = true;
	_childrenDirty: boolean = false;
	
	// Track nodes that this absolute positioned box overlaps
	// Public with underscore prefix to allow test access
	_overlappedNodes: Set<ElementNode> = new Set();
	
	// Track absolute positioned boxes that overlap this node
	// Public with underscore prefix to allow test access
	_overlappingAbsoluteBoxes: Set<ElementNode> = new Set();

  /**
   * Convert camelCase to kebab-case
   */
  private camelToKebab(str: string): string {
    return str.replace(/([a-z0-9])([A-Z])/g, '$1-$2').toLowerCase();
  }

  /**
   * Mark this node as dirty (needs re-render)
   */
  markDirty(): void {
    this._isDirty = true;
    // Propagate dirty flag up to parent
    if (this.parentNode && this.parentNode instanceof ElementNode) {
      this.parentNode._childrenDirty = true;
    }
    
    // If this is an absolute positioned box, mark all overlapped nodes as dirty
    if (this.isAbsolutePositioned()) {
      for (const node of this._overlappedNodes) {
        node._isDirty = true;
      }
    }
  }

  /**
   * Check if this node or its children are dirty
   */
  isDirty(): boolean {
    return this._isDirty || this._childrenDirty;
  }

  /**
   * Clear dirty flags after rendering
   */
  clearDirty(): void {
    this._isDirty = false;
    this._childrenDirty = false;
  }
  
  /**
   * Check if this element has absolute positioning
   */
  isAbsolutePositioned(): boolean {
    return this.getAttribute('position') === 'absolute';
  }
  
  /**
   * Register that this absolute positioned box overlaps another node
   */
  addOverlappedNode(node: ElementNode): void {
    if (!this._overlappedNodes.has(node)) {
      this._overlappedNodes.add(node);
      node._overlappingAbsoluteBoxes.add(this);
    }
  }
  
  /**
   * Remove a node from the overlapped set (no longer overlapping)
   */
  removeOverlappedNode(node: ElementNode): void {
    if (this._overlappedNodes.has(node)) {
      this._overlappedNodes.delete(node);
      node._overlappingAbsoluteBoxes.delete(this);
      // Mark the node as dirty since it's no longer covered
      node._isDirty = true;
    }
  }
  
  /**
   * Clear all overlap tracking for this node
   */
  clearOverlapTracking(): void {
    // Remove this from all nodes it was overlapping
    for (const node of this._overlappedNodes) {
      node._overlappingAbsoluteBoxes.delete(this);
      node._isDirty = true;
    }
    this._overlappedNodes.clear();
    
    // Remove all absolute boxes that were overlapping this
    for (const box of this._overlappingAbsoluteBoxes) {
      box._overlappedNodes.delete(this);
    }
    this._overlappingAbsoluteBoxes.clear();
  }
  
  /**
   * Get the computed bounds of this element
   */
  getBounds(): { x: number; y: number; width: number; height: number } | null {
    if (!this.yogaNode) {
      return null;
    }
    
    return {
      x: this.yogaNode.getComputedLeft(),
      y: this.yogaNode.getComputedTop(),
      width: this.yogaNode.getComputedWidth(),
      height: this.yogaNode.getComputedHeight(),
    };
  }

  /**
   * Override setAttribute to update Yoga styles when style attributes change
   */
  setAttribute(key: string, value: any): void {
    const wasAbsolute = this.isAbsolutePositioned();
    this.markDirty();
    
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
    
    // If position changed to/from absolute, clear overlap tracking
    if (key === 'position' && wasAbsolute !== this.isAbsolutePositioned()) {
      this.clearOverlapTracking();
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