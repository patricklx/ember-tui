import ElementNode from "../dom/nodes/ElementNode";
import { calculateLayout } from "../dom/layout.js";
import Output from "./Output.js";
import { renderNodeToOutput } from "./renderNodeToOutput.js";
import { TerminalBoxElement } from "../dom/native-elements/TerminalBoxElement.js";
import { elementIterator } from '../dom/nodes/DocumentNode';

// Cache for static element output
let staticOutputCache: string[] = [];


function* staticElementIterator(el: any): Generator<ElementNode, void, undefined> {
  if (el.getAttribute('internal_static')) {
		yield el;
    return;
  }
  for (const child of el.childNodes) {
    yield* staticElementIterator(child);
  }
}


/**
 * Extract lines from the document tree using layout-based rendering
 *
 * This function:
 * 1. Calculates layout using Yoga
 * 2. Creates an Output instance for coordinate-based rendering
 * 3. Renders each node using renderNodeToOutput
 * 4. Extracts the final output and converts to lines
 * 5. Handles static elements separately - they are cached and not re-rendered
 */
export function extractLines(rootNode: ElementNode): {
	static: string[],
	dynamic: string[],
} {
	// Get terminal dimensions
	const terminalWidth = process.stdout.columns || 80;
	const terminalHeight = process.stdout.rows || 24;

	// Calculate layout for the entire tree
	calculateLayout(rootNode, terminalWidth, terminalHeight);

	// First, render static elements if they haven't been rendered yet
	const staticElements: TerminalBoxElement[] = [];

  for (const element of staticElementIterator(rootNode)) {
    staticElements.push(element);
  }

	// If static elements have new children, render only the new ones and cache
	if (staticElements.length) {

		// Render only NEW children from static elements
		for (const staticElement of staticElements) {
			const staticOutput = new Output({
				width: staticElement.yogaNode!.getComputedWidth(),
				height: staticElement.yogaNode!.getComputedHeight(),
			});

			if (!staticElement.firstElement() || staticElement.childNodes.every(c => c.staticRendered)) {
				continue;
			}

			renderNodeToOutput(staticElement, staticOutput, {
				offsetX: 0,
				offsetY: 0,
				transformers: [],
				skipStaticElements: false,
			});
			const { output: staticRendered } = staticOutput.get();
			const newStaticLines = staticRendered.split('\n');

			for (const el of staticElement.childNodes) {
				el.staticRendered = true;
				if (el.yogaNode) {
					staticElement.yogaNode?.removeChild(el.yogaNode);
				}
			}

			staticOutputCache.push(...newStaticLines);
		}
	}

	const height = rootNode.childNodes.map(c => c.yogaNode?.getComputedHeight() || 0).reduce((x, y) => x + y, 0);

	// Create output buffer with calculated height
	const output = new Output({
		width: rootNode.yogaNode?.getComputedWidth(),
		height: height,
	});

	// Render the node tree to the output buffer, skipping static elements
	renderNodeToOutput(rootNode, output, {
		offsetX: 0,
		offsetY: 0,
		transformers: [],
		skipStaticElements: true,
	});

	// Extract the final output
	const { output: renderedOutput } = output.get();

	// Convert to lines
	const dynamicLines = renderedOutput.split('\n');

	return {
		static: staticOutputCache,
		dynamic: dynamicLines
	};
}

