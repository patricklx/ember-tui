import { invalidateRectCache } from '../input/hit-detection';
import { render as applyRender, type RenderOptions } from './apply-term-updates';
import type ElementNode from '../dom/nodes/ElementNode';
import type Process from "node:process";

export function render(rootNode: ElementNode, options?: RenderOptions | typeof Process): void {
  invalidateRectCache();
  applyRender(rootNode, options);
}
