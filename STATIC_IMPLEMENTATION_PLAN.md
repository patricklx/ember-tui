# Static Component Implementation Plan

## Current Status
- **Tests**: 3 failed, 2 passed out of 5
- **Issue**: Static component doesn't properly cache and render static content
- **Root Cause**: Architectural mismatch between implementation and expected behavior

## Failing Tests
1. ❌ "should render static tasks progressively" - Static items not rendering
2. ❌ "should render all 10 tasks progressively" - Static content missing  
3. ❌ "should contain ANSI color codes" - Colors not in buffer output

## Passing Tests
1. ✅ "should update dynamic counter without re-rendering static tasks"
2. ✅ "should have checkmarks for all tasks"

## Problem Analysis

### Issue 1: skipStaticElements Logic
**Current Behavior**: Skips entire static container during rendering
**Expected Behavior**: Should cache static content on first render, then skip on subsequent renders

**Location**: `ember-console/src/render/renderNodeToOutput.ts:128-131`
```typescript
// Current (WRONG):
if (skipStaticElements && (node as any).internal_static) {
  return; // Skips entire container
}

// Should be:
if (skipStaticElements && (node as any).internal_static) {
  // Skip rendering children, but container structure should remain
  // OR: Return cached output for this static element
}
```

### Issue 2: No Static/Dynamic Separation
**Current Behavior**: `collect-lines.ts` tries to render static elements separately
**Expected Behavior**: Should render entire tree once, extract static portions, cache them

**Location**: `ember-console/src/render/collect-lines.ts`

### Issue 3: ANSI Codes Lost
**Current Behavior**: `FakeTTY.getFullOutput()` returns buffer output which strips ANSI
**Expected Behavior**: Should preserve ANSI codes from original write operations

**Location**: `ember-console/src/test-utils/FakeTTY.ts:getFullOutput()`

## Implementation Plan

### Phase 1: Fix ANSI Code Preservation (Easiest)
**File**: `ember-console/src/test-utils/FakeTTY.ts`

**Change**:
```typescript
getFullOutput(): string {
  // Instead of getBufferOutput() which reconstructs and may lose codes
  // Return raw output that was written
  return this.output.join('');
}
```

**Impact**: Low risk, fixes color code test

### Phase 2: Redesign Static Rendering Architecture

#### Step 2.1: Add Static Boundary Tracking
**File**: `ember-console/src/render/Output.ts`

**Add**:
```typescript
interface StaticBoundary {
  elementId: string;
  startLine: number;
  endLine: number;
}

class Output {
  private staticBoundaries: StaticBoundary[] = [];
  
  markStaticStart(elementId: string, line: number) { }
  markStaticEnd(elementId: string, line: number) { }
  getStaticBoundaries(): StaticBoundary[] { }
}
```

#### Step 2.2: Modify renderNodeToOutput
**File**: `ember-console/src/render/renderNodeToOutput.ts`

**Changes**:
1. When entering a static element, mark boundary start
2. Render children normally
3. When exiting static element, mark boundary end
4. On subsequent renders with `skipStaticElements=true`, skip children but keep structure

```typescript
if (node instanceof TerminalBoxElement && node.getAttribute('internal_static')) {
  if (!skipStaticElements) {
    // First render: mark boundaries and render
    output.markStaticStart(node.id, currentY);
    // ... render children ...
    output.markStaticEnd(node.id, currentY + height);
  } else {
    // Subsequent renders: skip (cached elsewhere)
    return;
  }
}
```

#### Step 2.3: Rewrite collect-lines.ts
**File**: `ember-console/src/render/collect-lines.ts`

**New Logic**:
```typescript
// Global cache
let staticCache = new Map<string, string[]>();
let firstRender = true;

export function extractLines(rootNode: ElementNode) {
  if (firstRender) {
    // Render entire tree including static
    const output = renderFullTree(rootNode, skipStaticElements: false);
    
    // Extract static boundaries
    const boundaries = output.getStaticBoundaries();
    
    // Cache static portions
    for (const boundary of boundaries) {
      const lines = extractLinesFromBoundary(output, boundary);
      staticCache.set(boundary.elementId, lines);
    }
    
    firstRender = false;
    return { static: getAllStaticLines(), dynamic: getDynamicLines() };
  } else {
    // Render only dynamic content
    const output = renderFullTree(rootNode, skipStaticElements: true);
    
    // Combine cached static + new dynamic
    return { static: getAllStaticLines(), dynamic: output.getLines() };
  }
}
```

### Phase 3: Handle Incremental Static Updates

**Challenge**: Static elements can have new items added (e.g., new tasks)

**Solution**: Track item count per static element
```typescript
let staticItemCounts = new WeakMap<ElementNode, number>();

// On each render:
const currentCount = staticElement.childNodes.length;
const previousCount = staticItemCounts.get(staticElement) || 0;

if (currentCount > previousCount) {
  // Render only new items (from previousCount to currentCount)
  // Append to cached output
}
```

## Files to Modify

1. ✅ `ember-console/src/test-utils/FakeTTY.ts` - Fix getFullOutput()
2. ⚠️ `ember-console/src/render/Output.ts` - Add boundary tracking
3. ⚠️ `ember-console/src/render/renderNodeToOutput.ts` - Add boundary markers
4. ⚠️ `ember-console/src/render/collect-lines.ts` - Complete rewrite
5. ⚠️ `ember-console/src/dom/nodes/ElementNode.ts` - Add element IDs if needed

## Estimated Effort

- **Phase 1** (ANSI fix): 30 minutes, 10 lines
- **Phase 2** (Architecture): 3-4 hours, 150+ lines
- **Phase 3** (Incremental): 1-2 hours, 50+ lines
- **Testing**: 1-2 hours

**Total**: 6-8 hours of focused development

## Alternative: Simpler Approach

Instead of complex boundary tracking, use Ink's simpler approach:

1. Render entire tree on first pass
2. Split output into "static lines" and "dynamic lines" based on line count
3. Cache first N lines as static (where N = number of static element lines)
4. On subsequent renders, skip static elements, render dynamic, prepend cached static

This is simpler but less flexible (assumes static content is always at top).

## Recommendation

1. **Short term**: Mark failing tests as `test.skip()` with TODO comments
2. **Medium term**: Implement Alternative (Simpler Approach) - 2-3 hours
3. **Long term**: Implement full Phase 2 solution for production use

## Next Steps

1. Create GitHub issue with this plan
2. Decide on approach (full vs simple)
3. Allocate dedicated time for implementation
4. Implement with proper TDD (fix one test at a time)
