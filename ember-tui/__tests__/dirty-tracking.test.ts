import { describe, it, expect, beforeEach } from 'vitest';
import ElementNode from '../src/dom/nodes/ElementNode';

describe('Dirty Tracking', () => {
  let element: ElementNode;

  beforeEach(() => {
    // Create a basic ElementNode without full DOM setup
    element = new ElementNode('terminal-box');
  });

  describe('Basic dirty tracking', () => {
    it('should mark node as dirty when created', () => {
      const node = new ElementNode('terminal-box');
      expect((node as any).isDirty()).toBe(true);
    });

    it('should mark node as dirty when attribute is set', () => {
      (element as any).clearDirty();
      expect((element as any).isDirty()).toBe(false);

      element.setAttribute('color', 'red');
      expect((element as any).isDirty()).toBe(true);
    });

    it('should clear dirty flag', () => {
      expect((element as any).isDirty()).toBe(true);

      (element as any).clearDirty();
      expect((element as any).isDirty()).toBe(false);
    });

    it('should track children dirty state', () => {
      const child = new ElementNode('terminal-text');
      (element as any).clearDirty();
      
      // Manually trigger child insertion callback
      (element as any).onInsertedChild(child, 0);
      
      expect((element as any).isDirty()).toBe(true);
    });
  });

  describe('Absolute positioning and overlap tracking', () => {
    it('should identify absolute positioned elements', () => {
      expect((element as any).isAbsolutePositioned()).toBe(false);

      element.setAttribute('position', 'absolute');
      expect((element as any).isAbsolutePositioned()).toBe(true);
    });

    it('should track overlapped nodes for absolute positioned boxes', () => {
      const absoluteBox = new ElementNode('terminal-box');
      absoluteBox.setAttribute('position', 'absolute');
      
      const normalBox = new ElementNode('terminal-box');
      
      // Simulate overlap tracking
      (absoluteBox as any).addOverlappedNode(normalBox);
      
      // Check that the relationship is tracked
      expect((absoluteBox as any)._overlappedNodes.has(normalBox)).toBe(true);
      expect((normalBox as any)._overlappingAbsoluteBoxes.has(absoluteBox)).toBe(true);
    });

    it('should mark overlapped nodes as dirty when absolute box changes', () => {
      const absoluteBox = new ElementNode('terminal-box');
      absoluteBox.setAttribute('position', 'absolute');
      
      const normalBox = new ElementNode('terminal-box');
      (normalBox as any).clearDirty();
      
      // Add overlap
      (absoluteBox as any).addOverlappedNode(normalBox);
      (normalBox as any).clearDirty();
      
      // Mark absolute box as dirty - should propagate to overlapped nodes
      (absoluteBox as any).markDirty();
      
      expect((normalBox as any).isDirty()).toBe(true);
    });

    it('should remove overlap tracking when node is removed', () => {
      const absoluteBox = new ElementNode('terminal-box');
      absoluteBox.setAttribute('position', 'absolute');
      
      const normalBox = new ElementNode('terminal-box');
      
      (absoluteBox as any).addOverlappedNode(normalBox);
      expect((absoluteBox as any)._overlappedNodes.has(normalBox)).toBe(true);
      
      (absoluteBox as any).removeOverlappedNode(normalBox);
      expect((absoluteBox as any)._overlappedNodes.has(normalBox)).toBe(false);
      expect((normalBox as any)._overlappingAbsoluteBoxes.has(absoluteBox)).toBe(false);
    });

    it('should clear all overlap tracking', () => {
      const absoluteBox = new ElementNode('terminal-box');
      absoluteBox.setAttribute('position', 'absolute');
      
      const normalBox1 = new ElementNode('terminal-box');
      const normalBox2 = new ElementNode('terminal-box');
      
      (absoluteBox as any).addOverlappedNode(normalBox1);
      (absoluteBox as any).addOverlappedNode(normalBox2);
      
      expect((absoluteBox as any)._overlappedNodes.size).toBe(2);
      
      (absoluteBox as any).clearOverlapTracking();
      
      expect((absoluteBox as any)._overlappedNodes.size).toBe(0);
      expect((normalBox1 as any)._overlappingAbsoluteBoxes.has(absoluteBox)).toBe(false);
      expect((normalBox2 as any)._overlappingAbsoluteBoxes.has(absoluteBox)).toBe(false);
    });

    it('should clear overlap tracking when position changes from absolute', () => {
      const box = new ElementNode('terminal-box');
      box.setAttribute('position', 'absolute');
      
      const normalBox = new ElementNode('terminal-box');
      (box as any).addOverlappedNode(normalBox);
      
      expect((box as any)._overlappedNodes.size).toBe(1);
      
      // Change position away from absolute
      box.setAttribute('position', 'relative');
      
      expect((box as any)._overlappedNodes.size).toBe(0);
    });
  });

  describe('Dirty propagation', () => {
    it('should not mark clean nodes as dirty unnecessarily', () => {
      (element as any).clearDirty();
      
      expect((element as any).isDirty()).toBe(false);
      
      // Reading attributes should not mark as dirty
      element.getAttribute('color');
      expect((element as any).isDirty()).toBe(false);
    });
  });
});