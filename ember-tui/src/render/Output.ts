import sliceAnsi from 'slice-ansi';
import stringWidth from 'string-width';
import widestLine from 'widest-line';
import {
	type StyledChar,
	styledCharsFromTokens,
	styledCharsToString,
	tokenize,
} from '@alcalzone/ansi-tokenize';
import { debugLogger } from '../utils/debug-logger';

/**
 * "Virtual" output class
 *
 * Handles the positioning and saving of the output of each node in the tree.
 * Also responsible for applying transformations to each character of the output.
 *
 * Used to generate the final output of all nodes before writing it to actual output stream
 */

export type OutputTransformer = (s: string, index: number) => string;

type Options = {
	width: number;
	height: number;
};

type Operation = WriteOperation | ClipOperation | UnclipOperation;

type WriteOperation = {
	type: 'write';
	x: number;
	y: number;
	text: string;
	transformers: OutputTransformer[];
	overlay?: boolean;
};

type ClipOperation = {
	type: 'clip';
	clip: Clip;
};

type Clip = {
	x1: number | undefined;
	x2: number | undefined;
	y1: number | undefined;
	y2: number | undefined;
};

type UnclipOperation = {
	type: 'unclip';
};

export default class Output {
	width: number;
	height: number;

	private readonly operations: Operation[] = [];
	
	// Persistent buffer to keep state between renders
	private buffer: StyledChar[][] = [];

	constructor(options: Options) {
		const {width, height} = options;

		this.width = width;
		this.height = height;
	}

	write(
		x: number,
		y: number,
		text: string,
		options: {transformers: OutputTransformer[]; overlay?: boolean},
	): void {
		const {transformers, overlay} = options;

		if (!text) {
			return;
		}

		this.operations.push({
			type: 'write',
			x,
			y,
			text,
			transformers,
			overlay,
		});
	}

	clip(clip: Clip) {
		this.operations.push({
			type: 'clip',
			clip,
		});
	}

	unclip() {
		this.operations.push({
			type: 'unclip',
		});
	}

	/**
	 * Clear the output buffer for reuse
	 * Resets operations without recreating the entire Output instance
	 */
	clear(): void {
		this.operations.length = 0;
		// Keep buffer intact for incremental rendering
		// When skipClean is enabled, we only render dirty nodes on top of existing buffer
	}
	
	/**
	 * Reset the buffer completely (for full redraws)
	 */
	resetBuffer(): void {
		this.buffer = [];
	}

	get(): {output: string; height: number} {
		debugLogger.log(`Output.get(): operations count=${this.operations.length}`);

		// Reuse existing buffer or initialize if empty
		const output: StyledChar[][] = this.buffer.length > 0 ? this.buffer : [];

		// Store operations to process, then clear the array to prevent memory leaks
		const operationsToProcess = this.operations.slice();
		this.operations.length = 0;

		debugLogger.log(`  -> Processing ${operationsToProcess.length} operations, buffer rows=${output.length}`);

		// Helper function to ensure row exists
		const ensureRow = (y: number) => {
			while (output.length <= y) {
				const row: StyledChar[] = [];
				for (let x = 0; x < this.width; x++) {
					row.push({
						type: 'char',
						value: ' ',
						fullWidth: false,
						styles: [],
					});
				}
				output.push(row);
			}
		};

		// Pre-initialize rows up to terminal height for margin/padding preservation
		for (let y = 0; y < this.height; y++) {
			ensureRow(y);
		}

		const clips: Clip[] = [];

		for (const operation of operationsToProcess) {
			if (operation.type === 'clip') {
				clips.push(operation.clip);
			}

			if (operation.type === 'unclip') {
				clips.pop();
			}

			if (operation.type === 'write') {
				const {text, transformers, overlay} = operation;
				let {x, y} = operation;
				let lines = text.split('\n');

				const clip = clips.at(-1);

				if (clip) {
					const clipHorizontally =
						typeof clip?.x1 === 'number' && typeof clip?.x2 === 'number';

					const clipVertically =
						typeof clip?.y1 === 'number' && typeof clip?.y2 === 'number';

					// If text is positioned outside of clipping area altogether,
					// skip to the next operation to avoid unnecessary calculations
					if (clipHorizontally) {
						const width = widestLine(text);

						if (x + width < clip.x1! || x > clip.x2!) {
							continue;
						}
					}

					if (clipVertically) {
						const height = lines.length;

						if (y + height < clip.y1! || y > clip.y2!) {
							continue;
						}
					}

					if (clipHorizontally) {
						lines = lines.map(line => {
							const from = x < clip.x1! ? clip.x1! - x : 0;
							const width = stringWidth(line);
							const to = x + width > clip.x2! ? clip.x2! - x : width;

							return sliceAnsi(line, from, to);
						});

						if (x < clip.x1!) {
							x = clip.x1!;
						}
					}

					if (clipVertically) {
						const from = y < clip.y1! ? clip.y1! - y : 0;
						const height = lines.length;
						const to = y + height > clip.y2! ? clip.y2! - y : height;

						lines = lines.slice(from, to);

						if (y < clip.y1!) {
							y = clip.y1!;
						}
					}
				}

				let offsetY = 0;

				for (const [index, line] of lines.entries()) {
					// Ensure row exists (allows growth beyond initial height)
					ensureRow(y + offsetY);
					const currentLine = output[y + offsetY];

									let transformedLine = line;
									for (const transformer of transformers) {
										transformedLine = transformer(transformedLine, index);
									}
				const characters = styledCharsFromTokens(tokenize(transformedLine));
					let offsetX = x;

					for (const character of characters) {
						if (overlay) {
							// In overlay mode, preserve existing character but apply new background styles
							const existingChar = currentLine[offsetX];

							// Check if new character has background color
							const isBgColorCode = (code: string) => {
								return /\x1b\[(4[0-9]|10[0-7])m/.test(code);
							};
							const newBackgroundStyles = character.styles.filter(s =>
								s.type === 'ansi' && isBgColorCode(s.code)
							);

							// If new character is just a space with background color (overlay background)
							const isBackgroundSpace = character.value === ' ' && newBackgroundStyles.length > 0;

							if (isBackgroundSpace && existingChar) {
								// Preserve existing character and all its styles, only replace background
								const existingNonBgStyles = existingChar.styles.filter(s =>
									s.type !== 'ansi' || !isBgColorCode(s.code)
								);

								currentLine[offsetX] = {
									...existingChar,
									styles: [...existingNonBgStyles, ...newBackgroundStyles],
								};
							} else if (newBackgroundStyles.length > 0 && existingChar) {
								// New character has background - preserve existing foreground/style, apply new background
								const existingFgStyles = existingChar.styles.filter(s =>
									s.type !== 'ansi' || !isBgColorCode(s.code)
								);
								const newNonBgStyles = character.styles.filter(s =>
									s.type !== 'ansi' || !isBgColorCode(s.code)
								);
								
								currentLine[offsetX] = {
									...character,
									styles: [...existingFgStyles, ...newNonBgStyles, ...newBackgroundStyles],
								};
							} else {
								// Not a background-only overlay, write the character normally
								currentLine[offsetX] = character;
							}
						} else {
							// Normal mode: just replace the character
							currentLine[offsetX] = character;
						}

						// Determine printed width using string-width to align with measurement
						const characterWidth = Math.max(1, stringWidth(character.value));

						// For multi-column characters, clear following cells to avoid stray spaces/artifacts
						if (characterWidth > 1) {
							for (let index = 1; index < characterWidth; index++) {
								currentLine[offsetX + index] = {
									type: 'char',
									value: '',
									fullWidth: false,
									styles: character.styles,
								};
							}
						}

						offsetX += characterWidth;
					}

					offsetY++;
				}
			}
		}

		const generatedOutput = output
			.map(line => {
				// See https://github.com/vadimdemedes/ink/pull/564#issuecomment-1637022742
				const lineWithoutEmptyItems = line.filter(item => item !== undefined);
				const renderedLine = styledCharsToString(lineWithoutEmptyItems);

				// Only strip trailing whitespace if it comes after a reset code
				// This preserves spaces that are part of styled content (e.g., background colors)
				return renderedLine;
			})
			.join('\n');

		// Save buffer for next render
		this.buffer = output;

		return {
			output: generatedOutput,
			height: output.length,
		};
	}
}

