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
    if (!el.staticRendered) {
      yield el;
    }
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
export function extractLines(rootNode: ElementNode): string[] {
	// Get terminal dimensions
	const terminalWidth = process.stdout.columns || 80;
	const terminalHeight = process.stdout.rows || 24;

	// Calculate layout for the entire tree
	calculateLayout(rootNode, terminalWidth, terminalHeight);

	// First, render static elements if they haven't been rendered yet
	const staticElements: TerminalBoxElement[] = [];

  for (const element of staticElementIterator(rootNode)) {
    staticElements.push(element);
    element.staticRendered = true;
  }

	// If static elements have new children, render only the new ones and cache
	if (staticElements.length) {
		const staticOutput = new Output({
			width: terminalWidth,
			height: terminalHeight,
		});

		// Render only NEW children from static elements
		for (const staticElement of staticElements) {
			const allChildren = staticElement.childNodes.filter(n => n.nodeType === 1) as ElementNode[];

			// Render only children that haven't been rendered yet
			for (let i = 0; i < allChildren.length; i++) {
				const child = allChildren[i];
				renderNodeToOutput(child, staticOutput, {
					offsetX: 0,
					offsetY: 0,
					transformers: [],
					skipStaticElements: false,
				});
			}
		}

		const { output: staticRendered } = staticOutput.get();
		const newStaticLines = staticRendered.split('\n').filter(line => line.length > 0 || staticRendered.includes('\n'));

		// Append new lines to cache
		staticOutputCache.push(...newStaticLines);
	}

	// Create output buffer with terminal dimensions, offset by static content
	const output = new Output({
		width: terminalWidth,
		height: terminalHeight,
	});

	// Render the node tree to the output buffer, skipping static elements
	renderNodeToOutput(rootNode, output, {
		offsetX: 0,
		offsetY: 0,
		transformers: [],
		skipStaticElements: true,
	});

	// Extract the final output
	const {output: renderedOutput} = output.get();

	// Convert to lines
	const dynamicLines = renderedOutput.split('\n');

	// Combine static cache with dynamic content
	const lines = [...staticOutputCache, ...dynamicLines];

	return lines;
}

