# Bundle Async Cycles Detection Tool

## Purpose

This tool detects and analyzes async module initialization cycles that cause esbuild bundling failures in Quarto.

## The Problem: esbuild's Async Initialization Bug

### Root Cause

esbuild has a limitation when bundling modules with top-level await (async initialization). When async initialization propagates through the dependency graph to modules that form import cycles **with each other**, esbuild generates circular `await init_*()` dependencies that cannot be resolved.

### The Precise Failure Pattern

The build fails when **all** of these conditions are met:

1. **Root async module exists** - A module with actual top-level await (e.g., `hash.ts` with WASM initialization)
2. **Async propagates to cyclic modules** - The async initialization flows through imports to reach modules in cycles
3. **Cycles exist among async modules** - The affected modules have import cycles with **each other** (not just with non-async modules)

### Why This Causes Failures

When esbuild encounters this pattern:

```
Module A (async) → imports → Module B (async) → imports → Module A
```

It generates:

```javascript
// In Module A's init function
async function init_A() {
  await init_B(); // Must wait for B
  // ... A's initialization
}

// In Module B's init function
async function init_B() {
  await init_A(); // Must wait for A
  // ... B's initialization
}
```

This creates a **deadlock** - each module waits for the other to initialize first. esbuild's bundler sometimes generates invalid JavaScript when trying to handle this, resulting in syntax errors like "Unexpected reserved word 'await'" in non-async contexts.

### Important: Cycles Alone Are Not The Problem

The key insight: **modules can be in cycles without causing build failures**, as long as those cycles don't form among async modules themselves.

For example, this is **fine**:

```
async-module.ts ↔ helper.ts (not async) ↔ utils.ts (not async) → async-module.ts
```

But this **fails**:

```
async-module-A.ts ↔ async-module-B.ts ↔ async-module-C.ts → async-module-A.ts
```

## Two Solution Strategies

The tool provides two complementary approaches to fix these issues:

### Strategy 1: Chain Breaking (OUTSIDE cycles)

**Approach:** Break async propagation chains BEFORE they reach modules that cycle with each other.

**How it works:**

- Trace paths from root async modules to cycle files
- Find edges from non-cycle files into cycle files
- Make those imports dynamic to stop async propagation

**Advantages:**

- Usually requires fewer changes (1-2 dynamic imports)
- Strategic - breaks at entry points to problematic cycles
- Prevents async from infecting the cycle cluster

**Example:**

```typescript
// Before: static import propagates async
import { render } from "./render-shared.ts";

// After: dynamic import stops propagation
export async function checkRender() {
  const { render } = await import("./render-shared.ts");
  // ...
}
```

### Strategy 2: MFAS - Minimum Feedback Arc Set (WITHIN cycles)

**Approach:** Break cycles among async modules themselves.

**How it works:**

- Build subgraph of async modules in cycles + their neighbors
- Find minimum set of edges to remove to eliminate cycles
- Uses ILP (Integer Linear Programming) optimization

**Advantages:**

- Eliminates the cycles entirely
- May be necessary when entry points can't be modified
- Provides alternative if chain breaking isn't sufficient

**Example:** If async modules A, B, C form a cycle, MFAS identifies the minimum edges to make dynamic to break that cycle.

## How The Tool Works

### 1. Detection Phase

```
1. Parse the bundle to find all modules and async modules
2. Identify root async modules (modules with actual top-level await)
3. Generate complete import cycle data
4. Find intersection: async modules that are in cycles
```

### 2. Analysis Phase

```
For Chain Breaking:
1. Build dependency graph from bundle
2. Reverse graph to trace async propagation backwards
3. For each root async module:
   - Trace paths to cycle files
   - Find edges from non-cycle → cycle files
4. Use ILP to find minimum edges to cut all chains

For MFAS:
1. Build subgraph of async modules in cycles
2. Enumerate cycles within that subgraph
3. Use ILP to find minimum edges to break those cycles
```

### 3. Output

The tool provides:

- List of async modules in cycles
- Chain breaking recommendations (minimum edges OUTSIDE cycles)
- MFAS recommendations (minimum edges WITHIN cycles)
- Affected files for each recommendation

## Interpreting Results

### When Build Succeeds

If the build works and the tool reports:

- "N async modules in cycles"
- "No cycles found containing async modules"

This means:

- ✅ Async modules exist in cycles with non-async modules (fine!)
- ✅ No cycles exist among async modules themselves (what we want!)
- ✅ The dangerous pattern is not present

### When Build Fails

If the tool reports:

- "N async modules in cycles"
- "Found M cycle(s) containing async modules"

This means:

- ❌ Cycles exist among async modules themselves
- ❌ The dangerous pattern is present
- 🔧 Apply the recommended dynamic imports to fix

## Example Scenarios

### Scenario A: Safe (Build Works)

```
Root Async (hash.ts)
  ↓ (async propagation stopped by dynamic import)
render-shared.ts (in cycle with non-async modules)
  ↔ helper.ts (not async)
  ↔ utils.ts (not async)
```

**Result:** No cycles among async modules → Build succeeds

### Scenario B: Unsafe (Build Fails)

```
Root Async (hash.ts)
  ↓ (async propagation continues)
render-shared.ts (async, in cycle)
  ↔ render-contexts.ts (async, in cycle)
  ↔ engine.ts (async, in cycle)
```

**Result:** Cycles among async modules → Build fails

### Scenario C: Fixed with Chain Breaking

```
Root Async (hash.ts)
  ↓
base.ts → [DYNAMIC IMPORT] → cri.ts
  ↓ (async propagation STOPPED)
render-shared.ts (still in cycles, but not async)
  ↔ render-contexts.ts (not async)
  ↔ engine.ts (not async)
```

**Result:** Async doesn't reach the cycles → Build succeeds

## Implementation Details

### Cycle Detection

Uses DFS-based cycle detection with a limit of 1000 cycles for tractability.

### ILP Optimization

Both chain breaking and MFAS use Set Cover formulation:

- **Variables:** Binary (0/1) for each edge - should it be broken?
- **Constraints:** Each chain/cycle must have at least one edge broken
- **Objective:** Minimize total edges broken

This finds the optimal (minimum) set of edges to break.

### Subgraph Construction (MFAS)

The MFAS approach builds a focused subgraph:

```typescript
// Include async modules in cycles
for (const asyncModule of asyncInCycles) {
  subgraph.add(asyncModule);
  subgraph.add(asyncModule.dependencies);
}

// Include edges TO those modules (importers)
for (const [from, to] of graph.edges) {
  if (asyncModules.includes(to)) {
    subgraph.add(from → to);
  }
}
```

This captures cycles involving async modules while keeping the problem tractable.

## Usage

```bash
# Run the tool (uses default entry point: src/quarto.ts)
quarto run --dev package/src/common/import-report/report-bundle-async-cycles.ts

# Or specify a different entry point
quarto run --dev package/src/common/import-report/report-bundle-async-cycles.ts src/your-entry.ts
```

The entry point determines which cycles are analyzed - it should be the main entry to your application.

## Files Modified

The tool analyzes but does not modify any files. It provides recommendations that developers can implement:

**Chain Breaking typically affects:**

- Command files (check-render.ts, command-utils.ts)
- Entry points into render subsystems

**MFAS typically affects:**

- Core modules that cycle with each other
- Render, project, and engine modules

## Testing

After applying fixes:

```bash
# 1. Typecheck
package/dist/bin/quarto

# 2. Build
cd package && ./scripts/common/prepare-dist.sh

# 3. Re-run analysis to verify
quarto run --dev package/src/common/import-report/report-bundle-async-cycles.ts
```

Success indicators:

- Build completes without "Unexpected reserved word" errors
- Tool reports "No cycles found containing async modules"
- Minimal dynamic imports (typically 2-4)

## References

- **Original issue:** Quarto bundling fails with async initialization in cycles
- **Tool location:** `package/src/common/import-report/report-bundle-async-cycles.ts`
- **Related tools:**
  - `explain-all-cycles.ts` - Generates cycle data
  - `report-import-chains.ts` - Analyzes import chains

## Key Takeaways

1. **Cycles are OK** - Import cycles don't cause build failures by themselves
2. **Async cycles are NOT OK** - Cycles among async modules cause esbuild to generate invalid code
3. **Two solutions** - Break chains before cycles, or break cycles themselves
4. **Strategic fixes** - Use ILP optimization to find minimum changes needed
5. **Dynamic imports** - The workaround is making strategic imports dynamic to defer module loading
