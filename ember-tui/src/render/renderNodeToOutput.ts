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

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface RenderOptions {
	skipClean?: boolean;
	offsetX?: number;
	offsetY?: number;
	transformers?: OutputTransformer[];
	/** Force all children to re-render even when clean (overlay clearing). */
	_parentForcesDirty?: boolean;
}

// ---------------------------------------------------------------------------
// Text helpers
// ---------------------------------------------------------------------------

/**
 * Get maximum width for text wrapping inside a yoga node (subtracts padding/border).
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

function wrapText(text: string, maxWidth: number, textWrap: string): string {
	if (textWrap === 'wrap') {
		const lines = text.split('\n');
		const wrappedLines: string[] = [];

		for (const line of lines) {
			if (widestLine(line) <= maxWidth) {
				wrappedLines.push(line);
				continue;
			}

			const words = line.split(' ');
			let currentLine = '';

			for (const word of words) {
				const testLine = currentLine ? `${currentLine} ${word}` : word;
				if (widestLine(testLine) <= maxWidth) {
					currentLine = testLine;
				} else {
					if (currentLine) wrappedLines.push(currentLine);
					currentLine = word;
				}
			}

			if (currentLine) wrappedLines.push(currentLine);
		}

		return wrappedLines.join('\n');
	}

	if (textWrap === 'truncate') {
		return text.split('\n').map(line =>
			widestLine(line) <= maxWidth ? line : line.slice(0, maxWidth)
		).join('\n');
	}

	return text;
}

/**
 * Apply padding offsets to text based on the first child node's computed position.
 */
function applyPaddingToText(node: ElementNode, text: string): string {
	const yogaNode = node.childNodes[0]?.yogaNode;
	if (yogaNode) {
		text = '\n'.repeat(yogaNode.getComputedTop()) + indentString(text, yogaNode.getComputedLeft());
	}
	return text;
}

// ---------------------------------------------------------------------------
// Dirty detection
// ---------------------------------------------------------------------------

/**
 * Returns true if the node needs to be (re-)rendered.
 *
 * Uses two complementary signals:
 *  1. `node._isDirty` – set by the application whenever attributes/content change.
 *  2. `yogaNode.hasNewLayout()` – Yoga's own flag, set after `calculateLayout()`
 *     whenever *this specific node* received new computed values (position, size).
 *     Cleared by calling `yogaNode.markLayoutSeen()` once the node has been rendered.
 *
 * This is more generic than manually comparing coordinates against a cached
 * `_previousRenderState`, because Yoga tracks layout staleness internally and
 * covers cases such as a node moving due to a sibling change without any of its
 * own attributes changing.
 */
function isDirty(node: ElementNode): boolean {
	return node._isDirty || (node.yogaNode?.hasNewLayout() ?? false);
}

// ---------------------------------------------------------------------------
// Render-state cache helpers
// ---------------------------------------------------------------------------

function savePreviousRenderState(
	node: ElementNode,
	x: number,
	y: number,
	position: number,
	width: number,
	height: number,
	hasBackground: boolean,
): void {
	node._previousRenderState = { x, y, position, width, height, hasBackground };
}

// ---------------------------------------------------------------------------
// Overlap / area tracking (module-level, reset each frame)
// ---------------------------------------------------------------------------

const renderedNodesInCurrentFrame: Array<{
	node: ElementNode;
	x: number;
	y: number;
	width: number;
	height: number;
	isAbsolute: boolean;
}> = [];

export function resetRenderedNodesTracking(): void {
	renderedNodesInCurrentFrame.length = 0;
}

// ---------------------------------------------------------------------------
// Output helpers
// ---------------------------------------------------------------------------

/**
 * Clear a rectangular area in the output buffer.
 */
export function clearNodeArea(
	output: Output,
	x: number,
	y: number,
	width: number,
	height: number,
	transformers: OutputTransformer[] = [],
): void {
	for (let row = 0; row < height; row++) {
		const clearY = y + row;
		if (clearY < 0) continue;

		if (x === 0 && width >= output.width) {
			output.clearRow(clearY);
		} else if (clearY < output.buffer?.length) {
			output.write(x, clearY, ' '.repeat(width), { transformers });
		}
	}
}

function rectanglesOverlap(
	r1: { x: number; y: number; width: number; height: number },
	r2: { x: number; y: number; width: number; height: number },
): boolean {
	return !(
		r1.x + r1.width  <= r2.x ||
		r2.x + r2.width  <= r1.x ||
		r1.y + r1.height <= r2.y ||
		r2.y + r2.height <= r1.y
	);
}

// ---------------------------------------------------------------------------
// Pre-pass: clear stale absolute-node areas before the render pass
// ---------------------------------------------------------------------------

/**
 * Walk the entire tree and clear the previous render area of every node that
 * is now dirty.  Must run before `renderNodeToOutput` so that regular content
 * painted after this pre-pass is never wiped out.
 */
export function clearAbsoluteNodeAreas(
	node: ElementNode,
	output: Output,
	transformers: OutputTransformer[] = [],
): void {
	if (node._previousRenderState && isDirty(node)) {
		const prev = node._previousRenderState;
		clearNodeArea(output, prev.x, prev.y, prev.width, prev.height, transformers);
	}

	for (const child of node.childNodes) {
		clearAbsoluteNodeAreas(child as ElementNode, output, transformers);
	}
}

// ---------------------------------------------------------------------------
// Post-pass: update overlap tracking after the render pass is complete
// ---------------------------------------------------------------------------

export function processOverlapTracking(): void {
	const absoluteBoxes = renderedNodesInCurrentFrame.filter(r => r.isAbsolute);

	for (const absBox of absoluteBoxes) {
		const node = absBox.node;
		const previousOverlapped = new Set<ElementNode>((node as any)._overlappedNodes || []);
		const currentOverlapped = new Set<ElementNode>();

		for (const rendered of renderedNodesInCurrentFrame) {
			if (rendered.node === node || rendered.isAbsolute) continue;

			if (rectanglesOverlap(absBox, rendered)) {
				currentOverlapped.add(rendered.node);
				if (typeof (node as any).addOverlappedNode === 'function') {
					(node as any).addOverlappedNode(rendered.node);
				}
			}
		}

		for (const prevNode of previousOverlapped) {
			if (!currentOverlapped.has(prevNode)) {
				if (typeof (node as any).removeOverlappedNode === 'function') {
					(node as any).removeOverlappedNode(prevNode);
				}
			}
		}
	}
}

// ---------------------------------------------------------------------------
// Children render helper
// ---------------------------------------------------------------------------

function renderChildren(
	node: ElementNode,
	output: Output,
	childOptions: RenderOptions,
): void {
	for (const childNode of node.childNodes) {
		if (childNode.nodeType === 1) {
			renderNodeToOutput(childNode as ElementNode, output, childOptions);
		}
	}
}

// ---------------------------------------------------------------------------
// Main render function
// ---------------------------------------------------------------------------

export function renderNodeToOutput(
	node: ElementNode,
	output: Output,
	options: RenderOptions = {},
): void {
	const {
		offsetX = 0,
		offsetY = 0,
		transformers = [],
		_parentForcesDirty = false,
	} = options;

	debugLogger.log(`renderNodeToOutput: node=${node.tagName ?? node.nodeType}, type=${node.nodeType}`);

	const isNodeDirty = options.skipClean ? isDirty(node) : true;
	const hasChildrenDirty = node._childrenDirty;
	const hasOverlappingBoxes = node._overlappingAbsoluteBoxes.size > 0;

	const yogaNode = node.yogaNode;

	if (!yogaNode) {
		renderChildren(node, output, { ...options, offsetX: 0, offsetY: 0, _parentForcesDirty: false });
		return;
	}

	if (yogaNode.getDisplay() === Yoga.DISPLAY_NONE) {
		debugLogger.log('  -> Display none, skipping');
		node._previousRenderState = undefined as any;
		node.clearDirty();
		yogaNode.markLayoutSeen();
		return;
	}

	const x        = offsetX + yogaNode.getComputedLeft();
	const y        = offsetY + yogaNode.getComputedTop();
	const width    = yogaNode.getComputedWidth();
	const height   = yogaNode.getComputedHeight();
	const position = yogaNode.getPositionType();

	const hasBackground =
		node instanceof TerminalBoxElement &&
		Boolean(node.getAttribute('background-color') || node.getAttribute('background'));

	const isAbsolute = node.isAbsolutePositioned();

	renderedNodesInCurrentFrame.push({ node, x, y, width, height, isAbsolute });

	// --- Skip clean nodes ---
	if (options.skipClean && !isNodeDirty && !hasChildrenDirty && !hasOverlappingBoxes && !_parentForcesDirty) {
		// Still recurse if children are dirty
		if (hasChildrenDirty) {
			renderChildren(node, output, { skipClean: isNodeDirty, offsetX: x, offsetY: y, transformers });
		}
		savePreviousRenderState(node, x, y, position, width, height, hasBackground);
		yogaNode.markLayoutSeen();
		node.clearDirty();
		debugLogger.log('  -> Node and children are clean, skipping');
		return;
	}

	node.clearDirty();
	yogaNode.markLayoutSeen();

	// Transformer chain
	const newTransformers: OutputTransformer[] =
		typeof node.internal_transform === 'function'
			? [node.internal_transform, ...transformers]
			: transformers;

	// --- terminal-text ---
	if (node instanceof TerminalTextElement) {
		// Use rawText for wrapping so ANSI codes don't interfere with word-width
		// calculations, then apply the per-character transform to each wrapped line
		// so every line carries its own complete ANSI color codes.
		let rawText = node.rawText;

		if (rawText.length > 0) {
			const maxWidth = getMaxWidth(yogaNode);
			const textWrap = (node.getAttribute('text-wrap') ?? 'wrap') as string;
			if (widestLine(rawText) > maxWidth) {
				rawText = wrapText(rawText, maxWidth, textWrap);
			}
			// Apply the element's style transform to each individual line so every
			// line has self-contained ANSI codes (color start + reset).
			const text = rawText
				.split('\n')
				.map(line => node.transform(line))
				.join('\n');
			const paddedText = applyPaddingToText(node, text);
			output.write(x, y, paddedText, { transformers: newTransformers });
		}

		savePreviousRenderState(node, x, y, position, width, height, hasBackground);
		return;
	}

	// --- terminal-box ---
	if (node instanceof TerminalBoxElement) {
		renderBackground(x, y, node, output);
		renderBorder(x, y, node, output);

		let clipped = false;
		const overflowX  = node.getAttribute('overflow-x');
		const overflowY  = node.getAttribute('overflow-y');
		const overflow   = node.getAttribute('overflow');
		const clipH      = overflowX === 'hidden' || overflow === 'hidden';
		const clipV      = overflowY === 'hidden' || overflow === 'hidden';

		if (clipH || clipV) {
			output.clip({
				x1: clipH ? x + yogaNode.getComputedBorder(Yoga.EDGE_LEFT)  : undefined,
				x2: clipH ? x + width - yogaNode.getComputedBorder(Yoga.EDGE_RIGHT)  : undefined,
				y1: clipV ? y + yogaNode.getComputedBorder(Yoga.EDGE_TOP)   : undefined,
				y2: clipV ? y + height - yogaNode.getComputedBorder(Yoga.EDGE_BOTTOM) : undefined,
			});
			clipped = true;
		}

		const forceChildren = hasOverlappingBoxes || _parentForcesDirty;
		renderChildren(node, output, { skipClean: !isNodeDirty, offsetX: x, offsetY: y, transformers: newTransformers, _parentForcesDirty: forceChildren });

		if (clipped) output.unclip();

		savePreviousRenderState(node, x, y, position, width, height, hasBackground);
		return;
	}

	// --- Generic element node (render children) ---
	if (node.nodeType === 1) {
		const forceChildren = hasOverlappingBoxes || _parentForcesDirty;
		renderChildren(node, output, { skipClean: options.skipClean, offsetX: x, offsetY: y, transformers: newTransformers, _parentForcesDirty: forceChildren });
	}
}