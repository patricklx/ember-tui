import Yoga, {type Node as YogaNode} from 'yoga-layout';
import applyStyles, {type Styles} from './styles';
import type ElementNode from './nodes/ElementNode';
import type ViewNode from './nodes/ViewNode';
import measureText, { measureWrappedText } from '../render/measure-text';
import type Output from '../render/Output';
import type { OutputTransformer } from '../render/Output';
import { clearNodeArea } from '../render/renderNodeToOutput';

/**
 * Converts kebab-case to camelCase
 */
function toCamelCase(str: string): string {
	return str.replace(/-([a-z])/g, (_, letter) => letter.toUpperCase());
}

/**
 * Extracts all style attributes from an element
 * Handles both camelCase and kebab-case attribute names
 */
function extractStylesFromElement(element: ElementNode): Record<string, any> {
	const styles: Record<string, any> = {};

	// Check for style attribute object
	const styleAttr = element.getAttribute('style');
	if (styleAttr && typeof styleAttr === 'object') {
		Object.assign(styles, styleAttr);
	}

	// Get all attributes from the element
	const attributes = element.attributesObject;
	for (const attrName in attributes) {
		const value = attributes[attrName];

		// Convert kebab-case to camelCase
		const camelName = toCamelCase(attrName);
		
		// Try to convert numeric strings to numbers
		if (typeof value === 'string' && !isNaN(Number(value)) && value.trim() !== '') {
			styles[camelName] = Number(value);
		} else {
			styles[camelName] = value;
		}
	}

	return styles;
}

/**
 * Global list to track all created Yoga nodes and their elements for cleanup
 */
const createdYogaNodes: Array<{ node: YogaNode; element: ElementNode }> = [];

/**
 * Cleanup disconnected Yoga nodes to prevent memory leaks
 * Only frees nodes whose elements are no longer connected to the DOM
 * Optionally clears the area where disconnected nodes were rendered
 */
export function cleanupDisconnectedYogaNodes(
	output?: Output,
	transformers: OutputTransformer[] = []
): void {
	// Iterate backwards to safely remove items
	for (let i = createdYogaNodes.length - 1; i >= 0; i--) {
		const { node, element } = createdYogaNodes[i];
		
		// Check if element is still connected to the DOM
		if (!element.isConnected) {
			// Clear the area where this node was rendered before freeing it
			if (output) {
				const previousState = (element as any)._previousRenderState;
				if (previousState) {
					clearNodeArea(
						output,
						previousState.x,
						previousState.y,
						previousState.width,
						previousState.height,
						transformers
					);
					// Clear the cached state
					(element as any)._previousRenderState = undefined;
				}
			}
			
			try {
				node.unsetMeasureFunc();
				// Clear the reference on the element to allow GC
				element.yogaNode = undefined;
				node.free?.();
			} catch {
				// Node might already be freed, ignore
			}
			// Remove from yoga parent/children tracking maps
			yogaParentMap.delete(element);
			yogaChildrenMap.delete(element);
			// Remove from tracking array
			createdYogaNodes.splice(i, 1);
		}
	}
}

/**
 * Free all previously created Yoga nodes to prevent memory leaks
 * @deprecated Use cleanupDisconnectedYogaNodes() for better performance
 */
export function freeAllYogaNodes(): void {
	// Free nodes in reverse order to avoid issues with parent-child relationships
	for (let i = createdYogaNodes.length - 1; i >= 0; i--) {
		const { node, element } = createdYogaNodes[i];
		try {
			node.unsetMeasureFunc();
			// Clear the reference on the element to allow GC
			element.yogaNode = undefined;
			node.free?.();
		} catch {
			// Node might already be freed, ignore
		}
	}
	// Clear the array to allow garbage collection of freed node references
	createdYogaNodes.length = 0;
	// Clear element-level tracking maps
	yogaParentMap.clear();
	yogaChildrenMap.clear();
}

/**
 * Creates a Yoga node for an element and applies styles from attributes
 */
export function createYogaNode(element: ElementNode): YogaNode {
	const yogaNode = Yoga.Node.create();

	// Track this node and its element for cleanup
	createdYogaNodes.push({ node: yogaNode, element });

	// Extract and apply all style attributes from the element
	const styles = extractStylesFromElement(element);
	if (Object.keys(styles).length > 0) {
		applyStyles(yogaNode, styles as Styles);
	}

	// Set measure function for text elements
	if (element.tagName === 'terminal-text') {
		yogaNode.setMeasureFunc((width) => {
			// Use rawText (unstyled) so ANSI codes don't inflate visual width.
			// Fall back to `text` for backward compatibility.
			const text = (element as any).rawText || (element as any).text || '';
			if (!text) return { width: 0, height: 0 };

			const natural = measureText(text);

			// When Yoga provides a finite container width, return the *natural*
			// text width (Yoga will cap it to the container via flex layout) but
			// use the *wrapped* height so that sibling elements are pushed down
			// correctly when the text spans multiple visual lines.
			if (width > 0 && isFinite(width)) {
				const wrapped = measureWrappedText(text, Math.floor(width));
				return { width: natural.width, height: wrapped.height };
			}

			return natural;
		});
	}

	return yogaNode;
}

/**
 * Tracks the yoga parent of each child element.
 * Keyed by child ElementNode → parent ElementNode.
 *
 * Yoga's WASM bindings return a *new* JS wrapper object on every call to
 * getParent() / getChild(), so `===` identity checks always fail.
 * We therefore maintain our own element-level maps instead.
 */
const yogaParentMap = new Map<ElementNode, ElementNode>();

/**
 * Tracks the ordered list of yoga children for each parent element.
 * Keyed by parent ElementNode → ElementNode[].
 */
const yogaChildrenMap = new Map<ElementNode, ElementNode[]>();

/**
 * Recursively builds Yoga node tree from DOM tree
 * Reuses existing Yoga nodes when possible to improve performance
 */
function buildYogaTree(node: ViewNode): void {
	// Only process element nodes
	if (node.nodeType !== 1) {
		return;
	}

	const element = node as ElementNode;

	// Reuse existing Yoga node if available, otherwise create new one
	if (!element.yogaNode) {
		element.yogaNode = createYogaNode(element);
	} else if (element._isDirty) {
		// Only re-apply styles when the node is dirty — calling setters on a
		// clean node causes Yoga to mark its own layout dirty, which in turn
		// makes hasNewLayout() return true for every node every frame and
		// defeats the skipClean optimisation in renderNodeToOutput.
		const styles = extractStylesFromElement(element);
		if (Object.keys(styles).length > 0) {
			applyStyles(element.yogaNode, styles as Styles);
		}
	}

	// terminal-text elements are leaf nodes in Yoga tree (they have measure functions)
	// They cannot have Yoga children, but can have DOM children for text aggregation
	if (element.tagName === 'terminal-text') {
		return;
	}

	// Get (or create) the ordered list of yoga children we've previously tracked
	// for this element. We use element identity instead of YogaNode wrapper
	// identity because Yoga's WASM bindings return a new JS object on every
	// getParent()/getChild() call, making === comparisons unreliable.
	if (!yogaChildrenMap.has(element)) {
		yogaChildrenMap.set(element, []);
	}
	const trackedChildren = yogaChildrenMap.get(element)!;

	// Build children and ensure they're in the correct order
	let yogaChildIndex = 0;
	for (let i = 0; i < element.childNodes.length; i++) {
		const child = element.childNodes[i];

		if (child && child.nodeType === 1) {
			const childElement = child as ElementNode;

			// Build child's Yoga tree first
			buildYogaTree(childElement);

			if (childElement.yogaNode) {
				// If the child already belongs to a *different* parent, detach it first
				const currentParentElement = yogaParentMap.get(childElement);
				if (currentParentElement && currentParentElement !== element) {
					currentParentElement.yogaNode?.removeChild(childElement.yogaNode);
					const oldTracked = yogaChildrenMap.get(currentParentElement);
					if (oldTracked) {
						const idx = oldTracked.indexOf(childElement);
						if (idx !== -1) oldTracked.splice(idx, 1);
					}
					yogaParentMap.delete(childElement);
				}

				// Check if child is already at the correct position in our tracked list
				if (trackedChildren[yogaChildIndex] !== childElement) {
					// Remove from its current position in this parent's tracked list if present
					const existingIdx = trackedChildren.indexOf(childElement);
					if (existingIdx !== -1) {
						element.yogaNode.removeChild(childElement.yogaNode);
						trackedChildren.splice(existingIdx, 1);
					}
					// Insert at the correct position
					element.yogaNode.insertChild(childElement.yogaNode, yogaChildIndex);
					trackedChildren.splice(yogaChildIndex, 0, childElement);
					yogaParentMap.set(childElement, element);
				}

				yogaChildIndex++;
			}
		}
	}

	// Remove any extra tracked children that are no longer in the DOM
	while (trackedChildren.length > yogaChildIndex) {
		const removedChild = trackedChildren[yogaChildIndex]!;
		if (removedChild.yogaNode) {
			element.yogaNode.removeChild(removedChild.yogaNode);
		}
		yogaParentMap.delete(removedChild);
		trackedChildren.splice(yogaChildIndex, 1);
	}
}

/**
 * Calculates layout for the entire tree starting from root
 */
export function calculateLayout(
	rootNode: ViewNode,
	width?: number,
	height?: number,
): void {


	const rootElement = rootNode as ElementNode;

	buildYogaTree(rootElement);

	// Calculate layout
	if (rootElement.yogaNode) {
		rootElement.yogaNode.calculateLayout(
			width ?? Number.NaN,
			height ?? Number.NaN,
			Yoga.DIRECTION_LTR,
		);
	}
}

/**
 * Updates styles on an existing Yoga node
 */
export function updateYogaNodeStyles(
	element: ElementNode,
	styles: Styles,
): void {
	if (!element.yogaNode) {
		element.yogaNode = createYogaNode(element);
	}

	applyStyles(element.yogaNode, styles);
}

/**
 * Cleans up Yoga nodes recursively
 */
export function cleanupYogaTree(node: ViewNode): void {
	if (node.nodeType !== 1) {
		return;
	}

	const element = node as ElementNode;

	// Clean up children first
	for (const child of element.childNodes) {
		cleanupYogaTree(child);
	}

	// Clean up this node
	if (element.yogaNode) {
		element.yogaNode.unsetMeasureFunc();
		element.yogaNode.freeRecursive();
		element.yogaNode = undefined;
	}
}

/**
 * Gets computed layout for an element
 */
export function getComputedLayout(element: ElementNode): {
	left: number;
	top: number;
	width: number;
	height: number;
} | null {
	if (!element.yogaNode) {
		return null;
	}

	return {
		left: element.yogaNode.getComputedLeft(),
		top: element.yogaNode.getComputedTop(),
		width: element.yogaNode.getComputedWidth(),
		height: element.yogaNode.getComputedHeight(),
	};
}
