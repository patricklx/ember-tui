import cliBoxes from 'cli-boxes';
import chalk from 'chalk';
import colorize from '../dom/colorize.js';
import ElementNode from '../dom/nodes/ElementNode.js';
import type Output from './Output.js';
import Yoga from 'yoga-layout';

/**
 * Render border around a box element
 */
const renderBorder = (
	x: number,
	y: number,
	node: ElementNode,
	output: Output,
): void => {
	const borderStyle = node.getAttribute('border-style');

	if (!borderStyle) {
		return;
	}

	const yogaNode = (node as any).yogaNode;
	if (!yogaNode) {
		return;
	}

	const width = yogaNode.getComputedWidth();
	const height = yogaNode.getComputedHeight();

	// Ensure width and height are valid
	if (width <= 0 || height <= 0) {
		return;
	}

	const box =
		typeof borderStyle === 'string'
			? cliBoxes[borderStyle as keyof typeof cliBoxes]
			: borderStyle;

	const topBorderColor = node.getAttribute('border-top-color') ?? node.getAttribute('border-color');
	const bottomBorderColor = node.getAttribute('border-bottom-color') ?? node.getAttribute('border-color');
	const leftBorderColor = node.getAttribute('border-left-color') ?? node.getAttribute('border-color');
	const rightBorderColor = node.getAttribute('border-right-color') ?? node.getAttribute('border-color');

	const dimTopBorderColor = node.getAttribute('border-top-dim-color') ?? node.getAttribute('border-dim-color');
	const dimBottomBorderColor = node.getAttribute('border-bottom-dim-color') ?? node.getAttribute('border-dim-color');
	const dimLeftBorderColor = node.getAttribute('border-left-dim-color') ?? node.getAttribute('border-dim-color');
	const dimRightBorderColor = node.getAttribute('border-right-dim-color') ?? node.getAttribute('border-dim-color');

	const showTopBorder = node.getAttribute('border-top') !== false;
	const showBottomBorder = node.getAttribute('border-bottom') !== false;
	const showLeftBorder = node.getAttribute('border-left') !== false;
	const showRightBorder = node.getAttribute('border-right') !== false;

	const contentWidth =
		width - (showLeftBorder ? 1 : 0) - (showRightBorder ? 1 : 0);

	let topBorder = showTopBorder
		? colorize(
				(showLeftBorder ? box.topLeft : '') +
					box.top.repeat(contentWidth) +
					(showRightBorder ? box.topRight : ''),
				topBorderColor,
				'foreground',
			)
		: undefined;

	if (showTopBorder && dimTopBorderColor) {
		topBorder = chalk.dim(topBorder);
	}

	let verticalBorderHeight = height;

	if (showTopBorder) {
		verticalBorderHeight -= 1;
	}

	if (showBottomBorder) {
		verticalBorderHeight -= 1;
	}

	verticalBorderHeight = Math.max(verticalBorderHeight, 0);

	// Create vertical borders with newlines to span multiple rows
	const leftBorderChar = colorize(box.left, leftBorderColor, 'foreground');
	let leftBorder = Array(verticalBorderHeight).fill(leftBorderChar).join('\n');

	if (dimLeftBorderColor) {
		leftBorder = chalk.dim(leftBorder);
	}

	const rightBorderChar = colorize(box.right, rightBorderColor, 'foreground');
	let rightBorder = Array(verticalBorderHeight).fill(rightBorderChar).join('\n');

	if (dimRightBorderColor) {
		rightBorder = chalk.dim(rightBorder);
	}

	let bottomBorder = showBottomBorder
		? colorize(
				(showLeftBorder ? box.bottomLeft : '') +
					box.bottom.repeat(contentWidth) +
					(showRightBorder ? box.bottomRight : ''),
				bottomBorderColor,
				'foreground',
			)
		: undefined;

	if (showBottomBorder && dimBottomBorderColor) {
		bottomBorder = chalk.dim(bottomBorder);
	}

	const offsetY = showTopBorder ? 1 : 0;

	if (topBorder) {
		output.write(x, y, topBorder, {transformers: []});
	}

	if (showLeftBorder) {
		output.write(x, y + offsetY, leftBorder, {transformers: []});
	}

	if (showRightBorder) {
		output.write(x + width - 1, y + offsetY, rightBorder, {
			transformers: [],
		});
	}

	if (bottomBorder) {
		output.write(x, y + height - 1, bottomBorder, {transformers: []});
	}
};

export default renderBorder;
