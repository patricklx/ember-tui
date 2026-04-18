# Memory Leak Analysis - PR #82

## Test Results
- **Memory Growth**: ~2.45 MB over 2000 element toggles (exceeds 2 MB threshold)
- **Test Status**: FAILING - Memory leak confirmed

## Root Cause Analysis

### Issue: Yoga Nodes Not Being Freed During Element Removal

When toggling between elements in the template:
```gts
{{#if state.showFirst}}
  <Text @backgroundColor="green">First element</Text>
{{else}}
  <Text @backgroundColor="blue">Second element</Text>
{{/if}}
```

**Problem Flow:**
1. Element is removed from DOM when condition changes
2. New element is created and inserted
3. Old element's Yoga node is NOT freed
4. Yoga nodes accumulate in memory with each toggle

### Code Evidence

In `ember-tui/src/dom/layout.ts`:
- Line 222-227: Yoga nodes are reused if they exist, but never freed when elements are destroyed
- Line 330-354: `cleanupYogaTree()` exists but is NOT called during normal element removal
- Line 8: WeakMap stores references but doesn't trigger cleanup

### The Fix Needed

Elements need to call `cleanupYogaTree()` when they are removed from the DOM. This should happen in the element's lifecycle, likely in:
- `ElementNode.removeChild()` 
- `ViewNode` disposal
- Or a destructor/finalizer pattern

## Attempted Fixes in This Branch

Looking at the diff, multiple approaches were tried:
1. ✅ Added WeakMap for element references (good for GC)
2. ✅ Reusing Yoga nodes instead of recreating (prevents some leaks)
3. ✅ Improved child synchronization logic
4. ❌ BUT: Missing automatic cleanup trigger when elements are removed

## Recommended Solution

Add cleanup hook in element removal:

```typescript
// In ElementNode.ts or ViewNode.ts
removeChild(child: ViewNode): void {
  // ... existing removal logic ...
  
  // Clean up Yoga tree for removed child
  if (child.nodeType === 1) {
    cleanupYogaTree(child);
  }
}
```

Or implement a disposal pattern:
```typescript
[Symbol.dispose]() {
  cleanupYogaTree(this);
}
```

## Next Steps
1. Implement automatic cleanup on element removal
2. Test with the memory leak test
3. Verify heap growth stays under 2 MB threshold
