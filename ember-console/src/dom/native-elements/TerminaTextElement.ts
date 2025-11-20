import ElementNode from "../nodes/ElementNode";
import chalk from "chalk";
import { Styles } from "../styles";
import colorize from "../colorize";


export class TerminaTextElement extends ElementNode {
	text: string = '';
	/**
	A label for the element for screen readers.
	 */
	readonly 'aria-label'?: string;

	/**
	Hide the element from screen readers.
	 */
	readonly 'aria-hidden'?: boolean;

	/**
	Change text color. Ink uses Chalk under the hood, so all its functionality is supported.
	 */
	readonly color?: LiteralUnion<ForegroundColorName, string>;

	/**
	Same as `color`, but for the background.
	 */
	readonly backgroundColor?: LiteralUnion<ForegroundColorName, string>;

	/**
	Dim the color (make it less bright).
	 */
	readonly dimColor?: boolean;

	/**
	Make the text bold.
	 */
	readonly bold?: boolean;

	/**
	Make the text italic.
	 */
	readonly italic?: boolean;

	/**
	Make the text underlined.
	 */
	readonly underline?: boolean;

	/**
	Make the text crossed out with a line.
	 */
	readonly strikethrough?: boolean;

	/**
	Inverse background and foreground colors.
	 */
	readonly inverse?: boolean;

	/**
	This property tells Ink to wrap or truncate text if its width is larger than the container. If `wrap` is passed (the default), Ink will wrap text and split it into multiple lines. If `truncate-*` is passed, Ink will truncate text instead, resulting in one line of text with the rest cut off.
	 */
	readonly wrap?: Styles['textWrap'];

	constructor() {
		super('terminal-text');
	}

	updateText() {
		const t = this.childNodes
			.map((c) => (c as any).text)
			.filter(Boolean)
			.join('');
		this.text = this.transform(t);
	}

	transform(children: string): string {
		const dimColor = this.getAttribute('dim-color');
		const color = this.getAttribute('color');
		const backgroundColor = this.getAttribute('background-color');
		const bold = this.getAttribute('bold');
		const italic = this.getAttribute('italic');
		const underline = this.getAttribute('underline');
		const strikethrough = this.getAttribute('strikethrough');
		const inverse = this.getAttribute('inverse');
		const inheritedBackgroundColor = this.getAttribute('inheritedBackgroundColor');
		if (dimColor) {
			children = chalk.dim(children);
		}

		if (color) {
			children = colorize(children, color, 'foreground');
		}

		// Use explicit backgroundColor if provided, otherwise use inherited from parent Box
		const effectiveBackgroundColor =
			backgroundColor ?? inheritedBackgroundColor;
		if (effectiveBackgroundColor) {
			children = colorize(children, effectiveBackgroundColor, 'background');
		}

		if (bold) {
			children = chalk.bold(children);
		}

		if (italic) {
			children = chalk.italic(children);
		}

		if (underline) {
			children = chalk.underline(children);
		}

		if (strikethrough) {
			children = chalk.strikethrough(children);
		}

		if (inverse) {
			children = chalk.inverse(children);
		}

		return children;
	};
}
