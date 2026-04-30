import { invalidateRectCache } from '../input/hit-detection';
import { renderInternal } from './apply-term-updates';
import type ElementNode from '../dom/nodes/ElementNode';

export function render(rootNode: ElementNode): void {
  invalidateRectCache();
  renderInternal(rootNode);
}
