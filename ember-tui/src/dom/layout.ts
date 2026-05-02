import Yoga, {type Node as YogaNode} from 'yoga-layout';
import applyStyles, {type Styles} from './styles';
import type ElementNode from './nodes/ElementNode';
import type ViewNode from './nodes/ViewNode';
import measureText from '../render/measure-text';

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
		
		if (value === null || value === undefined) {
			continue;
		}

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
 */
export function cleanupDisconnectedYogaNodes(): void {
	// Iterate backwards to safely remove items
	for (let i = createdYogaNodes.length - 1; i >= 0; i--) {
		const { node, element } = createdYogaNodes[i];
		
		// Check if element is still connected to the DOM
		if (!element.isConnected) {
			try {
				node.unsetMeasureFunc();
				// Clear the reference on the element to allow GC
				element.yogaNode = undefined;
				node.free?.();
			} catch {
				// Node might already be freed, ignore
			}
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
		yogaNode.setMeasureFunc(() => {
			const text = (element as any).text || '';
			const dimensions = measureText(text);
			return {
				width: dimensions.width,
				height: dimensions.height,
			};
		});
	}

	return yogaNode;
}

/**
 * Recursively builds Yoga node tree from DOM tree
 * Reuses existing Yoga nodes when possible to improve performance
 */
function buildYogaTree(node: ViewNode): void {
	// Only process element nodes
	if (node.nodeType !== 1) {
		return;
	}

	if (node.staticRendered) {
		return;
	}

	const element = node as ElementNode;

	// Reuse existing Yoga node if available, otherwise create new one
	if (!element.yogaNode) {
		element.yogaNode = createYogaNode(element);
	} else {
		// Update styles on existing node
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

	// Track which children are already in the Yoga tree
	const existingYogaChildren = new Set<YogaNode>();
	const childCount = element.yogaNode.getChildCount();
	for (let i = 0; i < childCount; i++) {
		existingYogaChildren.add(element.yogaNode.getChild(i));
	}

	// Build children and ensure they're in the correct order
	let yogaChildIndex = 0;
	for (let i = 0; i < element.childNodes.length; i++) {
		const child = element.childNodes[i];

		if (child && child.nodeType === 1 && !child.staticRendered) {
			const childElement = child as ElementNode;

			// Build child's Yoga tree
			buildYogaTree(childElement);

			if (childElement.yogaNode) {
				// Check if child already has a parent
				const currentParent = childElement.yogaNode.getParent();
				if (currentParent && currentParent !== element.yogaNode) {
					currentParent.removeChild(childElement.yogaNode);
				}

				// Check if already a child at the correct position
				const existingChild = yogaChildIndex < childCount ? element.yogaNode.getChild(yogaChildIndex) : null;
				
				if (existingChild !== childElement.yogaNode) {
					// Remove from old position if exists
					if (existingYogaChildren.has(childElement.yogaNode)) {
						element.yogaNode.removeChild(childElement.yogaNode);
					}
					// Insert at correct position
					element.yogaNode.insertChild(childElement.yogaNode, yogaChildIndex);
				}
				
				yogaChildIndex++;
			}
		}
	}

	// Remove any extra children that are no longer in DOM
	while (element.yogaNode.getChildCount() > yogaChildIndex) {
		element.yogaNode.removeChild(element.yogaNode.getChild(yogaChildIndex));
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
