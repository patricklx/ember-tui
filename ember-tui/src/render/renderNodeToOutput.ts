import Yoga from 'yoga-layout';
import widestLine from 'widest-line';
import indentString from 'indent-string';
import type ElementNode from '../dom/nodes/ElementNode';
import { TerminalTextElement } from '../dom/native-elements/TerminalTextElement';
import { TerminalBoxElement } from '../dom/native-elements/TerminalBoxElement';
import type Output from './Output';
import type { OutputTransformer } from './Output';
import renderBorder from './render-border';
import renderBackground from './render-background';
import { debugLogger } from '../utils/debug-logger';

/**
 * Get maximum width for text wrapping
 */
function getMaxWidth(yogaNode: any): number {
	return (
		yogaNode.getComputedWidth() -
		yogaNode.getComputedPadding(Yoga.EDGE_LEFT) -
		yogaNode.getComputedPadding(Yoga.EDGE_RIGHT) -
		yogaNode.getComputedBorder(Yoga.EDGE_LEFT) -
		yogaNode.getComputedBorder(Yoga.EDGE_RIGHT)
	);
}

/**
 * Wrap text to fit within max width
 */
function wrapText(text: string, maxWidth: number, textWrap: string): string {
	if (textWrap === 'wrap') {
		const lines = text.split('\n');
		const wrappedLines: string[] = [];

		for (const line of lines) {
			if (widestLine(line) <= maxWidth) {
				wrappedLines.push(line);
				continue;
			}

			// Simple word wrapping
			const words = line.split(' ');
			let currentLine = '';

			for (const word of words) {
				const testLine = currentLine ? `${currentLine} ${word}` : word;

				if (widestLine(testLine) <= maxWidth) {
					currentLine = testLine;
				} else {
					if (currentLine) {
						wrappedLines.push(currentLine);
					}
					currentLine = word;
				}
			}

			if (currentLine) {
				wrappedLines.push(currentLine);
			}
		}

		return wrappedLines.join('\n');
	}

	if (textWrap === 'truncate') {
		return text.split('\n').map(line => {
			if (widestLine(line) <= maxWidth) {
				return line;
			}
			return line.slice(0, maxWidth);
		}).join('\n');
	}

	return text;
}

/**
 * Apply padding to text based on first child node's position
 */
function applyPaddingToText(node: ElementNode, text: string): string {
	const yogaNode = node.childNodes[0]?.yogaNode;

	if (yogaNode) {
		const offsetX = yogaNode.getComputedLeft();
		const offsetY = yogaNode.getComputedTop();
		text = '\n'.repeat(offsetY) + indentString(text, offsetX);
	}

	return text;
}

/**
 * Check if two rectangles overlap
 */
function rectanglesOverlap(
	r1: { x: number; y: number; width: number; height: number },
	r2: { x: number; y: number; width: number; height: number }
): boolean {
	return !(
		r1.x + r1.width <= r2.x ||
		r2.x + r2.width <= r1.x ||
		r1.y + r1.height <= r2.y ||
		r2.y + r2.height <= r1.y
	);
}

/**
 * Track all rendered nodes with their absolute positions for overlap detection
 */
const renderedNodesInCurrentFrame: Array<{
	node: ElementNode;
	x: number;
	y: number;
	width: number;
	height: number;
}> = [];

/**
 * Reset the rendered nodes tracking (call at start of each frame)
 */
export function resetRenderedNodesTracking(): void {
	renderedNodesInCurrentFrame.length = 0;
}

/**
 * Update overlap tracking for absolute positioned boxes
 */
function updateOverlapTracking(
	node: ElementNode,
	x: number,
	y: number,
	width: number,
	height: number
): void {
	if (!('isAbsolutePositioned' in node) || !(node as any).isAbsolutePositioned()) {
		return;
	}

	const absoluteBox = { x, y, width, height };
	const previousOverlapped = new Set<ElementNode>((node as any)._overlappedNodes || []);
	const currentOverlapped = new Set<ElementNode>();

	// Check all previously rendered nodes for overlap
	for (const rendered of renderedNodesInCurrentFrame) {
		// Don't check against self
		if (rendered.node === node) {
			continue;
		}

		// Check if this absolute box overlaps the rendered node
		if (rectanglesOverlap(absoluteBox, rendered)) {
			currentOverlapped.add(rendered.node);
			
			// Add to overlap tracking if not already tracked
			if (typeof (node as any).addOverlappedNode === 'function') {
				(node as any).addOverlappedNode(rendered.node);
			}
		}
	}

	// Remove nodes that are no longer overlapped
	for (const prevNode of previousOverlapped) {
		if (!currentOverlapped.has(prevNode)) {
			if (typeof (node as any).removeOverlappedNode === 'function') {
				(node as any).removeOverlappedNode(prevNode);
			}
		}
	}
}

/**
 * Render a node and its children to the output buffer
 */
export function renderNodeToOutput(
	node: ElementNode,
	output: Output,
	options: {
		skipClean?: boolean;
		offsetX?: number;
		offsetY?: number;
		transformers?: OutputTransformer[];
		skipStaticElements?: boolean;
	} = {},
): void {
	const {
		offsetX = 0,
		offsetY = 0,
		transformers = [],
		skipStaticElements = false,
	} = options;

	debugLogger.log(`renderNodeToOutput: node=${node.tagName || node.nodeType}, type=${node.nodeType}`);

	// Skip clean nodes if skipClean is enabled (performance optimization)
	// BUT: still process children if they might be dirty OR if there are overlapping absolute boxes
	const isNodeDirty = options.skipClean && 'isDirty' in node && typeof (node as any).isDirty === 'function' 
		? (node as any).isDirty() 
		: true;
	
	const hasChildrenDirty = '_childrenDirty' in node ? (node as any)._childrenDirty : false;
	const hasOverlappingBoxes = '_overlappingAbsoluteBoxes' in node && (node as any)._overlappingAbsoluteBoxes.size > 0;
	
	// Don't skip if: node is dirty, children are dirty, or node is overlapped by absolute boxes
	if (options.skipClean && !isNodeDirty && !hasChildrenDirty && !hasOverlappingBoxes) {
		debugLogger.log('  -> Node and children are clean, skipping');
		return;
	}
	
	// Clear dirty flag after processing this node
	if (isNodeDirty && typeof (node as any).clearDirty === 'function') {
		(node as any).clearDirty();
	}

	// Skip static elements if requested
	if (skipStaticElements && (node as any).internal_static) {
		debugLogger.log('  -> Skipping static element');
		return;
	}

	const yogaNode = node.yogaNode;

	if (!yogaNode) {
		debugLogger.log('  -> No yoga node, skipping');
		return;
	}

	// Skip hidden elements
	if (yogaNode.getDisplay() === Yoga.DISPLAY_NONE) {
		debugLogger.log('  -> Display none, skipping');
		return;
	}

	// Calculate absolute position
	const x = offsetX + yogaNode.getComputedLeft();
	const y = offsetY + yogaNode.getComputedTop();
	const width = yogaNode.getComputedWidth();
	const height = yogaNode.getComputedHeight();

	// Track this node's position for overlap detection
	renderedNodesInCurrentFrame.push({ node, x, y, width, height });

	// Handle transformers
	let newTransformers = transformers;
	if (typeof (node as any).internal_transform === 'function') {
		newTransformers = [(node as any).internal_transform, ...transformers];
	}

	// Handle terminal-text elements
	if (node instanceof TerminalTextElement) {
		let text = node.text;

		if (text.length > 0) {
			const currentWidth = widestLine(text);
			const maxWidth = getMaxWidth(yogaNode);

			if (currentWidth > maxWidth) {
				const textWrap = node.getAttribute('text-wrap') ?? 'wrap';
				text = wrapText(text, maxWidth, textWrap as string);
			}

			text = applyPaddingToText(node, text);

			output.write(x, y, text, {transformers: newTransformers});
		}

		return;
	}

	// Handle terminal-box elements
	if (node instanceof TerminalBoxElement) {
		// Update overlap tracking for absolute positioned boxes
		updateOverlapTracking(node, x, y, width, height);

		// Render background
		renderBackground(x, y, node, output);

		// Render border
		renderBorder(x, y, node, output);

		// Handle clipping
		let clipped = false;
		const overflowX = node.getAttribute('overflow-x');
		const overflowY = node.getAttribute('overflow-y');
		const overflow = node.getAttribute('overflow');

		const clipHorizontally = overflowX === 'hidden' || overflow === 'hidden';
		const clipVertically = overflowY === 'hidden' || overflow === 'hidden';

		if (clipHorizontally || clipVertically) {
			const x1 = clipHorizontally
				? x + yogaNode.getComputedBorder(Yoga.EDGE_LEFT)
				: undefined;

			const x2 = clipHorizontally
				? x +
					yogaNode.getComputedWidth() -
					yogaNode.getComputedBorder(Yoga.EDGE_RIGHT)
				: undefined;

			const y1 = clipVertically
				? y + yogaNode.getComputedBorder(Yoga.EDGE_TOP)
				: undefined;

			const y2 = clipVertically
				? y +
					yogaNode.getComputedHeight() -
					yogaNode.getComputedBorder(Yoga.EDGE_BOTTOM)
				: undefined;

			output.clip({x1, x2, y1, y2});
			clipped = true;
		}

		// Render children
		for (const childNode of node.childNodes) {
			if (childNode.nodeType === 1) {
				renderNodeToOutput(childNode as ElementNode, output, {
					skipClean: options.skipClean,
					offsetX: x,
					offsetY: y,
					transformers: newTransformers,
					skipStaticElements,
				});
			}
		}

		if (clipped) {
			output.unclip();
		}

		return;
	}

	// Handle generic element nodes (render children)
	if (node.nodeType === 1) {
		for (const childNode of node.childNodes) {
			if (childNode.nodeType === 1) {
				renderNodeToOutput(childNode as ElementNode, output, {
					skipClean: options.skipClean,
					offsetX: x,
					offsetY: y,
					transformers: newTransformers,
					skipStaticElements,
				});
			}
		}
	}
}