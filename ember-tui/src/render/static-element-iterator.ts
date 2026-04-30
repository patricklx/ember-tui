import ElementNode from '../dom/nodes/ElementNode';
import type { TerminalBoxElement } from '../dom/native-elements/TerminalBoxElement';

export function* staticElementIterator(el: ElementNode): Generator<TerminalBoxElement, void, undefined> {
  if (el.getAttribute('internal_static')) {
    yield el as TerminalBoxElement;
    return;
  }
  for (const child of el.childNodes) {
    if (child instanceof ElementNode) {
      yield* staticElementIterator(child);
    }
  }
}
