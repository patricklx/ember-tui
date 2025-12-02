
import type ElementNode from './ElementNode';

export function* elementIterator(el: any): Generator<ElementNode, void, undefined> {
  yield el;
  for (const child of el.childNodes) {
    yield* elementIterator(child);
  }
}
