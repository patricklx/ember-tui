import Yoga from 'yoga-layout';
import widestLine from 'widest-line';
import indentString from 'indent-string';
import ElementNode from '../dom/nodes/ElementNode.js';
import { TerminaTextElement } from '../dom/native-elements/TerminaTextElement.js';
import { TerminalBoxElement } from '../dom/native-elements/TerminalBoxElement.js';
import type Output from './Output.js';
import type { OutputTransformer } from './Output.js';
import renderBorder from './render-border.js';
import renderBackground from './render-background.js';

/**
 * Squash text nodes into a single string
 */
function squashTextNodes(node: ElementNode): string {
	let text = '';

	for (const child of node.childNodes) {
		if (child instanceof TerminaTextElement) {
			text += child.text;
		} else if (child.nodeType === 1) {
			text += squashTextNodes(child as ElementNode);
		}
	}

	return text;
}

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
 * Render a node and its children to the output buffer
 */
export function renderNodeToOutput(
	node: ElementNode,
	output: Output,
	options: {
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

	// Skip static elements if requested
	if (skipStaticElements && (node as any).internal_static) {
		return;
	}

	const yogaNode = node.yogaNode;

	if (!yogaNode) {
		return;
	}

	// Skip hidden elements
	if (yogaNode.getDisplay() === Yoga.DISPLAY_NONE) {
		return;
	}

	// Calculate absolute position
	const x = offsetX + yogaNode.getComputedLeft();
	const y = offsetY + yogaNode.getComputedTop();

	// Handle transformers
	let newTransformers = transformers;
	if (typeof (node as any).internal_transform === 'function') {
		newTransformers = [(node as any).internal_transform, ...transformers];
	}

	// Handle terminal-text elements
	if (node instanceof TerminaTextElement) {
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
					offsetX: x,
					offsetY: y,
					transformers: newTransformers,
					skipStaticElements,
				});
			}
		}
	}
}
