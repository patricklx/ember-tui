import type ElementNode from "../dom/nodes/ElementNode";
import { calculateLayout, cleanupDisconnectedYogaNodes } from "../dom/layout";
import Output from "./Output";
import { renderNodeToOutput, resetRenderedNodesTracking, processOverlapTracking, clearAbsoluteNodeAreas } from "./renderNodeToOutput";


// Reusable Output buffer to avoid recreation on each render
let dynamicOutputBuffer: Output | null = null;


export function resetOutputBuffer() {
	dynamicOutputBuffer = null;
}



/**
 * Extract lines from the document tree using layout-based rendering
 *
 * This function:
 * 1. Calculates layout using Yoga
 * 2. Creates an Output instance for coordinate-based rendering
 * 3. Renders each node using renderNodeToOutput
 * 4. Extracts the final output and converts to lines
 */
export function extractLines(rootNode: ElementNode, {
	terminalHeight,
	terminalWidth,
	skipClean
	// eslint-disable-next-line @typescript-eslint/no-unused-vars
}: { terminalHeight: number; terminalWidth: number; skipClean?: boolean }, _stdout: any) : {
	dynamic: string[],
} {

	// Calculate layout for the entire tree first (needed to get dimensions for clearing)
	const availableHeight = Math.max(0, terminalHeight);
	calculateLayout(rootNode, terminalWidth, availableHeight);

	const availableHeightForDynamic = Math.max(0, terminalHeight);
	calculateLayout(rootNode, terminalWidth, availableHeightForDynamic);

	// Exclude absolutely-positioned children from height: they are out of the flex flow.
	// Including them would cause the Output buffer to be recreated (and thus emptied) every
	// time an overlay box is added, which wipes out buffered text before the overlay can merge.
	const height = rootNode.childNodes
		.filter(c => c.getAttribute?.('position') !== 'absolute')
		.map(c => c.yogaNode?.getComputedHeight() || 0)
		.reduce((x, y) => x + y, 0);

	// Create output buffer with calculated height, but constrain to available terminal height
	// This prevents content from being rendered beyond the visible viewport
	const constrainedHeight = Math.min(height, availableHeightForDynamic);
	const outputWidth = rootNode.yogaNode?.getComputedWidth() ?? terminalWidth;
	
	// Reuse existing output buffer if dimensions match, otherwise create new one
	if (!dynamicOutputBuffer || 
	    dynamicOutputBuffer.width !== outputWidth || 
	    dynamicOutputBuffer.height !== constrainedHeight) {
		dynamicOutputBuffer = new Output({
			width: outputWidth,
			height: constrainedHeight,
		});
	} else {
		// Clear the buffer for reuse
		dynamicOutputBuffer.clear();
	}

	// Cleanup disconnected Yoga nodes and clear their areas
	cleanupDisconnectedYogaNodes(dynamicOutputBuffer);

	// Reset overlap tracking for this frame
	resetRenderedNodesTracking();

	// Pre-pass: clear the previous render areas of ALL absolute-positioned nodes
	// first, before any regular content is written, so their stale pixels are
	// gone before normal elements paint over those cells.
	clearAbsoluteNodeAreas(rootNode, dynamicOutputBuffer);

	// Render the node tree to the output buffer, skipping static elements
	// Enable skipClean to only render dirty nodes for performance
	renderNodeToOutput(rootNode, dynamicOutputBuffer, {
		skipClean,
		offsetX: 0,
		offsetY: 0,
		transformers: [],
	});
	
	// Process overlap tracking after all nodes have been rendered
	// This must happen after the render pass is complete
	processOverlapTracking();

	// Extract the final output
	const { output: renderedOutput } = dynamicOutputBuffer.get();

	// Convert to lines
	const dynamicLines = renderedOutput
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .split('\n');

	return {
		dynamic: dynamicLines
	};
}

