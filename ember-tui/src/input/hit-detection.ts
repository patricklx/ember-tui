/**
 * Hit-testing for terminal mouse events.
 *
 * Two separate concerns are handled here:
 *
 * 1. **Listener node registry** – a flat `Set<ViewNode>` that is updated
 *    immediately whenever `addEventListener` / `removeEventListener` is called
 *    on any node.  No tree traversal needed at hit-test time.
 *
 * 2. **Rect cache** – a `WeakMap` that stores the computed absolute bounds for
 *    each node.  It is populated lazily on the first hit-test after a render
 *    and is wiped by `invalidateRectCache()` which is called from
 *    `renderInternal` after every render pass.
 */

import type ViewNode from '../dom/nodes/ViewNode';
import { getScrollBufferSize } from '../render/apply-term-updates';
import { getListenerNodes } from './listener-nodes';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface AbsRect {
  left: number;
  top: number;
  right: number;   // exclusive (left + width)
  bottom: number;  // exclusive (top + height)
}

export interface HitTestResult {
  /** Nodes under the cursor that have mouse listeners, deepest first. */
  hit: ViewNode[];
  /**
   * Nodes that were hit on the *previous* call but not this one.
   * Use to dispatch `mouseleave`.
   */
  left: ViewNode[];
}

// ---------------------------------------------------------------------------
// Rect cache  (cleared after every render)
// ---------------------------------------------------------------------------

let rectCache: WeakMap<ViewNode, AbsRect | null> = new WeakMap();

/** Called by `renderInternal` after every render pass. */
export function invalidateRectCache(): void {
  rectCache = new WeakMap();
}

/** Return cached absolute rect, computing and storing it on first access. */
export function getAbsRect(node: ViewNode): AbsRect | null {
  if (rectCache.has(node)) return rectCache.get(node)!;

  const yogaNode = node.yogaNode;
  if (!yogaNode) {
    rectCache.set(node, null);
    return null;
  }

  let left = 0;
  let top = 0;
  let width = 0;
  let height = 0;
  let current: typeof yogaNode | null = yogaNode;
  let first = true;

  while (current) {
    const layout = current.getComputedLayout();
    left += layout.left;
    top  += layout.top;
    if (first) {
      width  = layout.width;
      height = layout.height;
      first  = false;
    }
    current = current.getParent();
  }

  const rect: AbsRect = { left, top, right: left + width, bottom: top + height };
  rectCache.set(node, rect);
  return rect;
}

// ---------------------------------------------------------------------------
// Hit test
// ---------------------------------------------------------------------------

/** Nodes hit on the previous mouse event — used to generate `mouseleave`. */
let previouslyHit: Set<ViewNode> = new Set();

/**
 * Find all registered listener nodes whose absolute bounds contain (`x`, `y`).
 *
 * Coordinates follow terminal convention: 1-based column / row.
 * Yoga layout is 0-based, so we subtract 1 before comparing.
 */
export function hitTest(x: number, y: number): HitTestResult {
  const col = x - 1;
  // Terminal reports y in viewport coordinates (1-based).
  // Add scrollBufferSize to convert to absolute content coordinates (0-based).
  const row = (y - 1) + getScrollBufferSize();

  const hit: ViewNode[] = [];

  for (const node of getListenerNodes()) {
    const rect = getAbsRect(node);
    if (!rect) continue;
    if (col >= rect.left && col < rect.right && row >= rect.top && row < rect.bottom) {
      hit.push(node);
    }
  }

  // Sort deepest-first: smaller area = more specific/deeper node.
  // This is a good heuristic for non-overlapping layouts; proper depth
  // sorting would require traversing the parent chain which is O(depth).
  hit.sort((a, b) => {
    const ra = getAbsRect(a)!;
    const rb = getAbsRect(b)!;
    const areaA = (ra.right - ra.left) * (ra.bottom - ra.top);
    const areaB = (rb.right - rb.left) * (rb.bottom - rb.top);
    return areaA - areaB;
  });

  const currentSet = new Set(hit);
  const left: ViewNode[] = [];
  for (const node of previouslyHit) {
    if (!currentSet.has(node)) left.push(node);
  }
  previouslyHit = currentSet;

  return { hit, left };
}

/** Reset hover tracking — call when the view is torn down or mouse leaves the window. */
export function resetHitState(): void {
  previouslyHit = new Set();
}


