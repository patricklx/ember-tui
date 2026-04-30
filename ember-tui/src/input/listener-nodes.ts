/**
 * Shared registry of nodes that have mouse or keyboard event listeners.
 *
 * Kept in its own leaf module so that ViewNode can import the
 * register/unregister helpers without pulling in hit-detection.ts
 * (which transitively imports the render pipeline and creates a
 * circular-dependency with the DOM layer).
 */

import type ViewNode from '../dom/nodes/ViewNode';

// ---------------------------------------------------------------------------
// Mouse listener registry
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

// ---------------------------------------------------------------------------
// Key listener registry
// ---------------------------------------------------------------------------

const keyListenerNodes: Set<ViewNode> = new Set();

export function registerKeyListenerNode(node: ViewNode): void {
  keyListenerNodes.add(node);
}

export function unregisterKeyListenerNode(node: ViewNode): void {
  keyListenerNodes.delete(node);
}

export function getKeyListenerNodes(): ReadonlySet<ViewNode> {
  return keyListenerNodes;
}
