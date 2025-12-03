import ElementNode from "../dom/nodes/ElementNode";
import { calculateLayout } from "../dom/layout";
import Output from "./Output";
import { renderNodeToOutput } from "./renderNodeToOutput";
import { TerminalBoxElement } from "../dom/native-elements/TerminalBoxElement";

// Cache for static element output
let staticOutputCache: string[] = [];

export function resetStaticCache() {
	staticOutputCache = [];
}


function* staticElementIterator(el: ElementNode): Generator<TerminalBoxElement, void, undefined> {
  if (el.getAttribute('internal_static')) {
		yield el as TerminalBoxElement;
    return;
  }
  for (const child of el.childNodes) {
    if (child instanceof ElementNode) {
      yield* staticElementIterator(child);
    }
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
export function extractLines(rootNode: ElementNode, {
	terminalHeight,
	terminalWidth,
	// eslint-disable-next-line @typescript-eslint/no-unused-vars
}: { terminalHeight: number; terminalWidth: number }, _stdout: any) : {
	static: string[],
	dynamic: string[],
} {

	// Calculate layout for the entire tree
	const availableHeight = Math.max(0, terminalHeight - staticOutputCache.length);
	calculateLayout(rootNode, terminalWidth, availableHeight);

	// First, render static elements if they haven't been rendered yet
	const staticElements: TerminalBoxElement[] = [];

  for (const element of staticElementIterator(rootNode)) {
    staticElements.push(element);
  }

	// If static elements have new children, render only the new ones and cache
	if (staticElements.length) {

		// Render only NEW children from static elements
		for (const staticElement of staticElements) {
			const staticHeight = staticElement.yogaNode!.getComputedHeight();
			const staticOutput = new Output({
				width: terminalWidth,
				height: staticHeight,
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

	const availableHeightForDynamic = Math.max(0, terminalHeight - staticOutputCache.length);
	calculateLayout(rootNode, terminalWidth, availableHeightForDynamic);

	const height = rootNode.childNodes.map(c => c.yogaNode?.getComputedHeight() || 0).reduce((x, y) => x + y, 0);

	// Create output buffer with calculated height, but constrain to available terminal height
	// This prevents content from being rendered beyond the visible viewport
	const constrainedHeight = Math.min(height, availableHeightForDynamic);
	const outputWidth = rootNode.yogaNode?.getComputedWidth() ?? terminalWidth;
	const output = new Output({
		width: outputWidth,
		height: constrainedHeight,
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

