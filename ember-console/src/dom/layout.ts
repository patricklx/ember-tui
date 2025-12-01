import Yoga, {type Node as YogaNode} from 'yoga-layout';
import applyStyles, {type Styles} from './styles.ts';
import type ElementNode from './nodes/ElementNode.ts';
import type ViewNode from './nodes/ViewNode.ts';
import measureText from '../render/measure-text.ts';

/**
 * Creates a Yoga node for an element and applies styles from attributes
 */
export function createYogaNode(element: ElementNode): YogaNode {
	const yogaNode = Yoga.Node.create();

	// Apply styles from the element's attributes
	const styleAttr = element.getAttribute('style');
	if (styleAttr && typeof styleAttr === 'object') {
		applyStyles(yogaNode, styleAttr as Styles);
	}

	// Apply individual style attributes
	const styles: Partial<Styles> = {};

	// Flexbox properties (check both camelCase and kebab-case)
	if (element.hasAttribute('flexDirection') || element.hasAttribute('flex-direction')) {
		styles.flexDirection = (element.getAttribute('flexDirection') || element.getAttribute('flex-direction')) as any;
	}
	if (element.hasAttribute('flexGrow') || element.hasAttribute('flex-grow')) {
		styles.flexGrow = Number(element.getAttribute('flexGrow') || element.getAttribute('flex-grow'));
	}
	if (element.hasAttribute('flexShrink') || element.hasAttribute('flex-shrink')) {
		styles.flexShrink = Number(element.getAttribute('flexShrink') || element.getAttribute('flex-shrink'));
	}
	if (element.hasAttribute('flexBasis') || element.hasAttribute('flex-basis')) {
		styles.flexBasis = (element.getAttribute('flexBasis') || element.getAttribute('flex-basis')) as any;
	}
	if (element.hasAttribute('flexWrap') || element.hasAttribute('flex-wrap')) {
		styles.flexWrap = (element.getAttribute('flexWrap') || element.getAttribute('flex-wrap')) as any;
	}
	if (element.hasAttribute('alignItems') || element.hasAttribute('align-items')) {
		styles.alignItems = (element.getAttribute('alignItems') || element.getAttribute('align-items')) as any;
	}
	if (element.hasAttribute('alignSelf') || element.hasAttribute('align-self')) {
		styles.alignSelf = (element.getAttribute('alignSelf') || element.getAttribute('align-self')) as any;
	}
	if (element.hasAttribute('justifyContent') || element.hasAttribute('justify-content')) {
		styles.justifyContent = (element.getAttribute('justifyContent') || element.getAttribute('justify-content')) as any;
	}

	// Dimensions
	if (element.hasAttribute('width')) {
		styles.width = element.getAttribute('width') as any;
	}
	if (element.hasAttribute('height')) {
		styles.height = element.getAttribute('height') as any;
	}
	if (element.hasAttribute('minWidth') || element.hasAttribute('min-width')) {
		styles.minWidth = (element.getAttribute('minWidth') || element.getAttribute('min-width')) as any;
	}
	if (element.hasAttribute('minHeight') || element.hasAttribute('min-height')) {
		styles.minHeight = (element.getAttribute('minHeight') || element.getAttribute('min-height')) as any;
	}
	if (element.hasAttribute('maxWidth') || element.hasAttribute('max-width')) {
		styles.maxWidth = (element.getAttribute('maxWidth') || element.getAttribute('max-width')) as any;
	}
	if (element.hasAttribute('maxHeight') || element.hasAttribute('max-height')) {
		styles.maxHeight = (element.getAttribute('maxHeight') || element.getAttribute('max-height')) as any;
	}

	// Spacing
	if (element.hasAttribute('margin')) {
		styles.margin = Number(element.getAttribute('margin'));
	}
	if (element.hasAttribute('marginX') || element.hasAttribute('margin-x')) {
		styles.marginX = Number(element.getAttribute('marginX') || element.getAttribute('margin-x'));
	}
	if (element.hasAttribute('marginY') || element.hasAttribute('margin-y')) {
		styles.marginY = Number(element.getAttribute('marginY') || element.getAttribute('margin-y'));
	}
	if (element.hasAttribute('marginTop') || element.hasAttribute('margin-top')) {
		styles.marginTop = Number(element.getAttribute('marginTop') || element.getAttribute('margin-top'));
	}
	if (element.hasAttribute('marginBottom') || element.hasAttribute('margin-bottom')) {
		styles.marginBottom = Number(element.getAttribute('marginBottom') || element.getAttribute('margin-bottom'));
	}
	if (element.hasAttribute('marginLeft') || element.hasAttribute('margin-left')) {
		styles.marginLeft = Number(element.getAttribute('marginLeft') || element.getAttribute('margin-left'));
	}
	if (element.hasAttribute('marginRight') || element.hasAttribute('margin-right')) {
		styles.marginRight = Number(element.getAttribute('marginRight') || element.getAttribute('margin-right'));
	}

	if (element.hasAttribute('padding')) {
		styles.padding = Number(element.getAttribute('padding'));
	}
	if (element.hasAttribute('paddingX') || element.hasAttribute('padding-x')) {
		styles.paddingX = Number(element.getAttribute('paddingX') || element.getAttribute('padding-x'));
	}
	if (element.hasAttribute('paddingY') || element.hasAttribute('padding-y')) {
		styles.paddingY = Number(element.getAttribute('paddingY') || element.getAttribute('padding-y'));
	}
	if (element.hasAttribute('paddingTop') || element.hasAttribute('padding-top')) {
		styles.paddingTop = Number(element.getAttribute('paddingTop') || element.getAttribute('padding-top'));
	}
	if (element.hasAttribute('paddingBottom') || element.hasAttribute('padding-bottom')) {
		styles.paddingBottom = Number(element.getAttribute('paddingBottom') || element.getAttribute('padding-bottom'));
	}
	if (element.hasAttribute('paddingLeft') || element.hasAttribute('padding-left')) {
		styles.paddingLeft = Number(element.getAttribute('paddingLeft') || element.getAttribute('padding-left'));
	}
	if (element.hasAttribute('paddingRight') || element.hasAttribute('padding-right')) {
		styles.paddingRight = Number(element.getAttribute('paddingRight') || element.getAttribute('padding-right'));
	}

	// Gap
	if (element.hasAttribute('gap')) {
		styles.gap = Number(element.getAttribute('gap'));
	}
	if (element.hasAttribute('columnGap') || element.hasAttribute('column-gap')) {
		styles.columnGap = Number(element.getAttribute('columnGap') || element.getAttribute('column-gap'));
	}
	if (element.hasAttribute('rowGap') || element.hasAttribute('row-gap')) {
		styles.rowGap = Number(element.getAttribute('rowGap') || element.getAttribute('row-gap'));
	}

	// Position
	if (element.hasAttribute('position')) {
		styles.position = element.getAttribute('position') as any;
	}

	// Display
	if (element.hasAttribute('display')) {
		styles.display = element.getAttribute('display') as any;
	}

	// Border
	if (element.hasAttribute('borderStyle') || element.hasAttribute('border-style')) {
		styles.borderStyle = (element.getAttribute('borderStyle') || element.getAttribute('border-style')) as any;
	}
	if (element.hasAttribute('borderTop') || element.hasAttribute('border-top')) {
		styles.borderTop = (element.getAttribute('borderTop') || element.getAttribute('border-top')) as boolean;
	}
	if (element.hasAttribute('borderBottom') || element.hasAttribute('border-bottom')) {
		styles.borderBottom = (element.getAttribute('borderBottom') || element.getAttribute('border-bottom')) as boolean;
	}
	if (element.hasAttribute('borderLeft') || element.hasAttribute('border-left')) {
		styles.borderLeft = (element.getAttribute('borderLeft') || element.getAttribute('border-left')) as boolean;
	}
	if (element.hasAttribute('borderRight') || element.hasAttribute('border-right')) {
		styles.borderRight = (element.getAttribute('borderRight') || element.getAttribute('border-right')) as boolean;
	}
	// Apply collected styles
	if (Object.keys(styles).length > 0) {
		applyStyles(yogaNode, styles);
	}

	// Set measure function for text elements
	if (element.tagName === 'terminal-text') {
		yogaNode.setMeasureFunc((width) => {
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

	// Create Yoga node if it doesn't exist
  element.yogaNode = createYogaNode(element);

	// terminal-text elements are leaf nodes in Yoga tree (they have measure functions)
	// They cannot have Yoga children, but can have DOM children for text aggregation
	if (element.tagName === 'terminal-text') {
		return;
	}

	for (let i = 0; i < element.childNodes.length; i++) {
		const child = element.childNodes[i];

		if (child && child.nodeType === 1 && !child.staticRendered) {
			const childElement = child as ElementNode;

			// Build child's Yoga tree
			buildYogaTree(childElement);

      element.yogaNode.insertChild(childElement.yogaNode, element.yogaNode.getChildCount());
		}
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
	if (rootNode.nodeType !== 1) {
		return;
	}

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
