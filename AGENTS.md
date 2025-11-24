# Agent Knowledge Base - Ember Console Project

## Project Overview
This is an Ember.js-based terminal UI library inspired by Ink (React for CLI). It uses:
- Ember.js 6.8.2 for component framework
- Yoga Layout (WebAssembly) for flexbox-based layout calculations
- Custom DOM implementation for terminal rendering
- ANSI escape codes for terminal styling

## Project Structure
```
ember/
├── ember-console/          # Core library
│   ├── src/
│   │   ├── components/     # Text.gts, Box.gts
│   │   ├── dom/           # Custom DOM implementation
│   │   ├── render/        # Rendering engine
│   │   └── index.ts
│   └── package.json
├── ember-console-demo/     # Demo application
│   ├── app/
│   │   ├── templates/     # View templates (.gts files)
│   │   └── boot.ts
│   └── package.json
└── package.json           # Workspace root
```

## Key Technical Details

### 1. Module Resolution
**Issue**: `emoji-regex` module export mismatch between versions
**Solution**: Add pnpm overrides in workspace root `package.json`:
```json
{
  "pnpm": {
    "overrides": {
      "string-width": "^8.1.0"
    }
  }
}
```

### 2. Yoga Layout Integration
**Library**: `yoga-layout@3.2.1` (WebAssembly-based flexbox engine)

**Critical Rules**:
- Each Yoga node can only have ONE parent
- Must remove child from previous parent before inserting into new parent
- Use `getParent()` to check current parent (not `getOwner()`)
- Check if child already exists before inserting to avoid duplicates

**Implementation Pattern**:
```typescript
// Check if child already has a parent
const currentParent = childYogaNode.getParent();
if (currentParent && currentParent !== parentYogaNode) {
  currentParent.removeChild(childYogaNode);
}

// Check if already a child to avoid duplicate insertion
const childCount = parentYogaNode.getChildCount();
let alreadyChild = false;
for (let j = 0; j < childCount; j++) {
  if (parentYogaNode.getChild(j) === childYogaNode) {
    alreadyChild = true;
    break;
  }
}

if (!alreadyChild) {
  parentYogaNode.insertChild(childYogaNode, childIndex);
}
```

### 3. Terminal I/O
**stdin.setRawMode Issue**: Only available when stdin is a TTY
```typescript
if (stdin.isTTY && typeof stdin.setRawMode === 'function') {
  stdin.setRawMode(true);
}
```

### 4. Rendering System

**Components**:
- `Output.ts`: Virtual output buffer with coordinate-based writing
- `renderNodeToOutput.ts`: Converts DOM tree to output operations
- `apply-term-updates.ts`: Applies minimal diffs to terminal
- `collect-lines.ts`: Extracts lines from rendered output

**Text Element Behavior**:
- Each `<Text>` component creates a `terminal-text` element
- Text content is transformed with ANSI codes for styling
- Newlines are added automatically to separate text elements
- Pre-formatted text preserves original whitespace

### 5. Border Rendering
**Critical Validation**: Always check dimensions before rendering borders
```typescript
const width = yogaNode.getComputedWidth();
const height = yogaNode.getComputedHeight();

if (width <= 0 || height <= 0) {
  return; // Skip rendering
}
```

**Why**: Negative dimensions cause `String.repeat()` to throw RangeError

### 6. Error Handling
**Pattern**: Wrap render functions in try-catch to prevent crashes
```typescript
export function render(rootElement: ElementNode): void {
  try {
    // rendering logic
  } catch (error) {
    console.error('Render error:', error);
    // Don't crash, just log
  }
}
```

## Common Issues & Solutions

### Issue: "Child already has a owner"
**Cause**: Attempting to insert a Yoga node that already has a parent
**Solution**: Remove from previous parent first (see Yoga Layout section)

### Issue: "memory access out of bounds" in Yoga
**Cause**: Incorrect child index when inserting nodes
**Solution**: Track actual Yoga node count separately from DOM childNodes

### Issue: Syntax errors in .gts files
**Cause**: Template syntax parser is strict about JavaScript syntax
**Solution**: Ensure proper brace matching and statement termination

## Build & Run Commands

```bash
# Install dependencies (from ember/ directory)
pnpm install

# Run demo app
cd ember-console-demo
pnpm start

# Build library
cd ember-console
pnpm build
```

## Testing Approach

1. **Start Test**: Run with timeout to catch crashes
   ```bash
   timeout 15 pnpm start
   ```

2. **View Switching**: Demo auto-switches views every 3 seconds
   - Colors Demo (0-3s)
   - Lorem Ipsum (3-6s)
   - Tomster ASCII Art (6-9s)
   - Box Layout Demo (9-12s)

3. **Check for**:
   - Crashes during view transitions
   - Memory errors from Yoga
   - Rendering errors (negative dimensions)
   - Layout issues (overlapping text)

## Known Limitations

2. **Non-TTY Environments**: Limited functionality when stdin is not a TTY
   - No raw mode
   - No keyboard input handling


## Development Notes

- Always test with actual terminal (not just piped output)
- Use `display_line_numbers` when reviewing files for precise edits
- Yoga layout is synchronous and blocks - keep trees small
- ANSI codes are counted in string length - use `string-width` for visual width
