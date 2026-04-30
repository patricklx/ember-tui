/**
 * Shared registry of nodes that have event listeners.
 *
 * Kept in its own leaf module so that ViewNode can import the
 * register/unregister helpers without pulling in hit-detection.ts
 * (which transitively imports the render pipeline and creates a
 * circular-dependency with the DOM layer).
 */

import type ViewNode from '../dom/nodes/ViewNode';

// ---------------------------------------------------------------------------
// Unified listener registry
// ---------------------------------------------------------------------------

const listenerNodes: Set<ViewNode> = new Set();

export function registerListenerNode(node: ViewNode): void {
  listenerNodes.add(node);
}

export function unregisterListenerNode(node: ViewNode): void {
  listenerNodes.delete(node);
}

export function getListenerNodes(): ReadonlySet<ViewNode> {
  return listenerNodes;
}
