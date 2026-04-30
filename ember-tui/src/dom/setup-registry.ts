import { registerElement } from './element-registry';
import { TerminalTextElement } from "./native-elements/TerminalTextElement";
import { TerminalBoxElement } from "./native-elements/TerminalBoxElement";
import ElementNode from "./nodes/ElementNode";

export function registerElements() {
  registerElement('terminal-text', () => new TerminalTextElement());
  registerElement('terminal-box', () => new TerminalBoxElement());
  registerElement('div', () => new ElementNode('div'));
  registerElement('style', () => new ElementNode('style'));
}
