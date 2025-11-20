/**
 * Render function for Ember-Ink
 * Renders Glimmer components to terminal output
 */

import { setup } from './setup.js';
import TerminalDocumentNode from './dom/nodes/TerminalDocumentNode.js';
import TerminalElementNode from './dom/nodes/TerminalElementNode.js';
import { elementIterator } from "./dom/nodes/DocumentNode";
import ElementNode from "./dom/nodes/ElementNode";
import TextNode from "./dom/nodes/TextNode";
import { TerminaTextElement } from "./dom/native-elements/TerminaTextElement";

export interface RenderOptions {
  /**
   * Output stream where app will be rendered.
   * @default process.stdout
   */
  stdout?: NodeJS.WriteStream;

  /**
   * Input stream where app will listen for input.
   * @default process.stdin
   */
  stdin?: NodeJS.ReadStream;

  /**
   * Error stream.
   * @default process.stderr
   */
  stderr?: NodeJS.WriteStream;
}

export interface RenderInstance {
  /**
   * The root document node
   */
  document: TerminalDocumentNode;

  /**
   * Unmount the app
   */
  unmount: () => void;

  /**
   * Clear the terminal output
   */
  clear: () => void;
}

/**
 * Render a Glimmer component to the terminal
 */
export function render(
  rootNode: ElementNode,
  options: RenderOptions = {}
): void {
	for (const node of elementIterator(rootNode)) {
		if (node instanceof TerminaTextElement) {
			console.log(node.text);
		}
	}
}
