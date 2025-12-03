import colorize from '../dom/colorize';
import ElementNode from '../dom/nodes/ElementNode';
import type Output from './Output';

/**
 * Render background color for a box element
 */
const renderBackground = (
	x: number,
	y: number,
	node: ElementNode,
	output: Output,
): void => {
	const backgroundColor = node.getAttribute('background-color');

	if (!backgroundColor) {
		return;
	}

	const yogaNode = (node as any).yogaNode;
	if (!yogaNode) {
		return;
	}

	const width = yogaNode.getComputedWidth();
	const height = yogaNode.getComputedHeight();

	// Calculate the actual content area considering borders
	const borderStyle = node.getAttribute('border-style');
	const leftBorderWidth =
		borderStyle && node.getAttribute('border-left') !== false ? 1 : 0;
	const rightBorderWidth =
		borderStyle && node.getAttribute('border-right') !== false ? 1 : 0;
	const topBorderHeight =
		borderStyle && node.getAttribute('border-top') !== false ? 1 : 0;
	const bottomBorderHeight =
		borderStyle && node.getAttribute('border-bottom') !== false ? 1 : 0;

	const contentWidth = width - leftBorderWidth - rightBorderWidth;
	const contentHeight = height - topBorderHeight - bottomBorderHeight;

	if (!(contentWidth > 0 && contentHeight > 0)) {
		return;
	}

	// Create background fill for each row
	const backgroundLine = colorize(
		' '.repeat(contentWidth),
		backgroundColor,
		'background',
	);

	for (let row = 0; row < contentHeight; row++) {
		output.write(
			x + leftBorderWidth,
			y + topBorderHeight + row,
			backgroundLine,
			{transformers: []},
		);
	}
};

export default renderBackground;
