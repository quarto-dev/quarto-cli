# Debugging Flaky Tests: A Systematic Approach

A methodology for debugging tests that fail intermittently in CI or when run as part of a test suite, but pass when run in isolation.

## Problem Pattern

Tests that hang or timeout when run in CI or as part of a test suite, but work fine when run alone. Common root cause categories:

1. **State pollution**: One test modifies global state that affects subsequent tests
2. **Resource leaks**: File handles, processes, or network connections not cleaned up
3. **Environment corruption**: Package managers (TinyTeX, npm, etc.) get into inconsistent state
4. **Timing/race conditions**: Tests depend on specific execution order or timing

## Investigation Methodology

### Phase 1: Reproduce Locally

**Goal**: Confirm you can reproduce the issue outside of CI.

1. Identify the failing test bucket from CI logs
2. Extract the test file list from CI configuration
3. Create a test script to run the bucket sequentially:

```bash
# array.sh - Run tests sequentially
readarray -t my_array < <(echo '[...]' | jq -rc '.[]')
haserror=0
for file in "${my_array[@]}"; do
  echo ">>> ./run-tests.sh ${file}"
  shopt -s globstar && ./run-tests.sh $file
  status=$?
  [ $status -eq 0 ] && echo ">>> No error" || haserror=1
done
```

4. Run and confirm the hang occurs locally

### Phase 2: Binary Search to Isolate Culprit

**Goal**: Find which specific test file causes the issue.

If test N causes state pollution, tests 1 through N-1 will pass, then the problematic test will occur.

1. Split your test list in half
2. Run first half + the hanging test:

```bash
# test-binary-search.sh
readarray -t tests < <(echo '[first_half_tests, "hanging-test.qmd"]' | jq -rc '.[]')
for file in "${tests[@]}"; do
  ./run-tests.sh $file || exit 1
done
```

3. If it hangs: culprit is in first half, repeat with first half
4. If it passes: culprit is in second half, repeat with second half
5. Continue until you identify the single test file

**Example**: In [#13647](https://github.com/quarto-dev/quarto-cli/issues/13647), binary search across 51 tests identified `render-format-extension.test.ts` as the culprit.

### Phase 3: Narrow Down Within Test File

**Goal**: Find which specific operation in the test file causes pollution.

1. Read the test file to understand what it does
2. Identify distinct operations (e.g., rendering different formats)
3. Comment out sections and retest:

```typescript
// Comment out formats one by one to isolate
// test("academic/document.qmd elsevier-pdf", ...)
// test("academic/document.qmd springer-pdf", ...)
test("academic/document.qmd acm-pdf", ...)
```

4. Binary search through the operations to find the specific one

**Example**: In #13647, rendering `academic/document.qmd` with `elsevier-pdf` format was the specific trigger.

### Phase 4: Understand the State Change

**Goal**: Determine what environmental change causes the issue.

Common suspects: package installations (TinyTeX, npm, pip), configuration file modifications, cache pollution, file system changes.

1. Create a clean test environment (fresh TinyTeX install)
2. Take snapshots before/after the problematic operation:

```bash
# Before snapshot
tlmgr list --only-installed > before.txt

# Run problematic test
./run-tests.sh problematic-test.ts

# After snapshot
tlmgr list --only-installed > after.txt
diff before.txt after.txt
```

3. For TinyTeX issues, check:
   - Installed packages: `tlmgr list --only-installed`
   - Package versions: `tlmgr info <package>`
   - Format files: `ls -la $(kpsewhich -var-value TEXMFSYSVAR)/web2c/luatex/`
   - What `tlmgr update --all` installs

**Example**: In #13647, `elsevier-pdf` rendering triggered `tlmgr update --all` which updated core packages and regenerated lualatex format files. The format regeneration expected modern conventions that conflicted with the bundled class file.

### Phase 5: Identify Root Cause

**Goal**: Understand WHY the state change causes the failure.

1. Compare working vs broken states in detail
2. For package version issues:
   - Check if test bundles old versions of libraries/classes
   - Compare with system-installed versions
   - Review changelogs between versions
3. Create minimal reproduction:

```bash
# verify-root-cause.sh
echo "=== Test 1: Old version ==="
# Setup with old version, run problematic operation, run hanging test

echo "=== Test 2: New version ==="
# Setup with new version, run problematic operation, run hanging test
```

**Example**: In #13647, the bundled `elsarticle.cls v3.3` was missing `\RequirePackage[T1]{fontenc}`. TinyTeX's `elsarticle.cls v3.4c` includes it. The font encoding mismatch corrupted lualatex format files, causing subsequent lualatex renders to hang.

### Phase 6: Verify Solution

**Goal**: Confirm your fix resolves the issue.

1. Apply the fix (update package, patch code, etc.)
2. Create verification script:

```bash
#!/bin/bash
echo ">>> Fresh environment setup"
# Clean install

echo ">>> Running problematic test (with fix)"
./run-tests.sh problematic-test.ts || exit 1

echo ">>> Testing previously-hanging test"
./run-tests.sh hanging-test.qmd || exit 1

echo "SUCCESS: Fix verified!"
```

3. Run multiple times to ensure consistency
4. Test with clean environment each time (critical for environment pollution issues)

## Key Debugging Tools

### TinyTeX

```bash
# List installed packages
tlmgr list --only-installed

# Check package info
tlmgr info <package>

# Find file locations
kpsewhich elsarticle.cls

# Check format files
ls -la $(kpsewhich -var-value TEXMFSYSVAR)/web2c/luatex/

# Clean TinyTeX (for fresh start)
rm -rf ~/.TinyTeX
quarto install tinytex
```

### Test Isolation

```bash
# Run single test
./run-tests.sh path/to/test.ts

# Run test sequence to reproduce ordering issues
for test in test1.ts test2.ts test3.ts; do
  ./run-tests.sh $test || break
done
```

### Package/Dependency Comparison

```bash
# Compare package versions
npm list
tlmgr list --only-installed
pip list

# Check for bundled vs system versions
find . -name "*.cls" -o -name "*.sty"
```

## Best Practices

1. **Always reproduce locally first** - CI is too slow for iterative debugging
2. **Use binary search** - Most efficient way to isolate culprits in large test suites
3. **Test with clean environments** - Especially for environment pollution issues
4. **Take snapshots** - Before/after comparisons are invaluable
5. **Create verification scripts** - Automate testing your fix
6. **Document the root cause** - Help others understand the issue

## Common Pitfalls

1. **Testing with polluted environment** - Always start fresh for environment issues
2. **Assuming causation from correlation** - Just because test A runs before test B doesn't mean A causes B's failure
3. **Stopping too early** - Finding the problematic test isn't enough; understand WHY it causes issues
4. **Not verifying the fix** - Always confirm your solution actually works

## Checklist

- [ ] Reproduce the issue locally
- [ ] Identify the specific test bucket that triggers the issue
- [ ] Use binary search to isolate the culprit test file
- [ ] Narrow down to specific operation within the test
- [ ] Take environment snapshots before/after
- [ ] Identify what environmental change occurs
- [ ] Understand WHY the change causes the failure
- [ ] Develop and apply a fix
- [ ] Verify the fix with clean environments
- [ ] Document the root cause and solution

## Case Study: #13647 (tufte.qmd Hanging in CI)

**Symptom**: `tufte.qmd` hangs after 10+ minutes when run after a bucket of tests. Same document renders fine in ~30s when run alone. Lualatex engine stuck during "running lualatex - 1".

**Investigation summary**:

```bash
# Binary search: 51 tests → render-format-extension.test.ts
# Narrow down: elsevier-pdf format was the trigger
# State change: tlmgr update --all regenerated format files
# Root cause: Bundled elsarticle.cls v3.3 missing fontenc, corrupting lualatex formats
# Fix: Update extension to use elsarticle.cls v3.4c
```

**References**:
- [quarto-dev/quarto-cli#13647](https://github.com/quarto-dev/quarto-cli/issues/13647)
- [quarto-journals/elsevier#38](https://github.com/quarto-journals/elsevier/pull/38) - Update elsarticle.cls
- [quarto-journals/elsevier#40](https://github.com/quarto-journals/elsevier/pull/40) - CTAN update
