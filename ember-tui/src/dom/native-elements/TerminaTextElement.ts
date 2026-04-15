import ElementNode from '../nodes/ElementNode';
import chalk, { type ForegroundColorName } from 'chalk';
import type { Styles } from '../styles';
import colorize from '../colorize';
import type { LiteralUnion } from "type-fest";
import type ViewNode from "../nodes/ViewNode";


interface Attributes {
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
}


export class TerminaTextElement extends ElementNode<Attributes> {
  text: string = '';


  constructor() {
    super('terminal-text');
  }

  setAttribute(key: string, value: any) {
    super.setAttribute(key, value);
    this.updateText();
  }

  removeChild(childNode: ViewNode) {
    super.removeChild(childNode);
    this.updateText();
  }

  updateText() {
    // Collect text from child nodes, preserving pre-formatted sections
    const parts: string[] = [];
    const preFormatted = this.getAttribute('pre-formatted');

		// Only iterate direct children, not all descendants
		// Child TerminaTextElements already have their text computed
		for (const child of this.childNodes) {
			if (child instanceof TerminaTextElement) {
				// Child TerminaTextElements already have their text formatted, just use it directly
				const childText = (child as any).text || '';
				if (childText) parts.push(childText);
			} else if ((child as any).text) {
				const t = (child as any).text;
				if (!preFormatted) {
					const normalized = t.split('\n')
            .map((line: string) => line.trim())
            .filter(Boolean)
            .join(' ')
            .replace(/[ \t\r\n]+/g, ' ');
					if (normalized) parts.push(normalized);
				} else {
					parts.push(t);
				}
			}
		}
    // Join with space, but normalize multiple spaces to single space
    const t = parts.join(' ');
    this.text = this.transform(t);

    // Notify parent TerminaTextElement to update if this element's text changed
    if (this.parentNode instanceof TerminaTextElement) {
      this.parentNode.updateText();
    }
  }

  transform(text: string): string {
    const dimColor = this.getAttribute('dim') || this.getAttribute('dim-color');
    const color = this.getAttribute('color');
    const backgroundColor = this.getAttribute('background-color');
    const bold = this.getAttribute('bold');
    const italic = this.getAttribute('italic');
    const underline = this.getAttribute('underline');
    const strikethrough = this.getAttribute('strikethrough');
    const inverse = this.getAttribute('inverse');
    const inheritedBackgroundColor = this.getAttribute('inheritedBackgroundColor');
    if (dimColor) {
      text = chalk.dim(text);
    }

    if (color) {
      text = colorize(text, color as string | ((str: string) => string) | undefined, 'foreground');
    }

    // Use explicit backgroundColor if provided, otherwise use inherited from parent Box
    const effectiveBackgroundColor =
      backgroundColor ?? inheritedBackgroundColor;
    if (effectiveBackgroundColor) {
      text = colorize(text, effectiveBackgroundColor as string | ((str: string) => string) | undefined, 'background');
    }

    if (bold) {
      text = chalk.bold(text);
    }

    if (italic) {
      text = chalk.italic(text);
    }

    if (underline) {
      text = chalk.underline(text);
    }

    if (strikethrough) {
      text = chalk.strikethrough(text);
    }

    if (inverse) {
      text = chalk.inverse(text);
    }

    return text;
  };
}
