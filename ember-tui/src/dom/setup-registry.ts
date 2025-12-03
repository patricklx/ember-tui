import { registerElement } from './element-registry';
import { TerminaTextElement } from "./native-elements/TerminaTextElement";
import { TerminalBoxElement } from "./native-elements/TerminalBoxElement";
import ElementNode from "./nodes/ElementNode";

export function registerElements() {
  registerElement('terminal-text', () => new TerminaTextElement());
  registerElement('terminal-box', () => new TerminalBoxElement());
  registerElement('div', () => new ElementNode('div'));
}
