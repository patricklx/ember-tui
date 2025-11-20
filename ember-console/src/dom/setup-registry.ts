import { registerElement } from './element-registry';
import { TerminaTextElement } from "./native-elements/TerminaTextElement";
import ElementNode from "./nodes/ElementNode";

export function registerElements() {
  registerElement('terminal-text', () => new TerminaTextElement());
  registerElement('div', () => new ElementNode('div'));
}
