---
name: investigate-issue
description: Use when investigating a suspected quarto-cli bug — a document that renders incorrectly, an unexpected error, or behavior that changed between versions. Not for "how does X work" or general architecture questions.
---

# Investigate a Quarto Bug

Gather evidence before writing a fix: reproduce the bug, isolate its root cause, and encode it
as a failing test.

## Phase 1: reproduce and document (no fix code yet)

1. **Triage** — check related issues/PRs/discussions before assuming this is a new bug;
   someone may already have found the cause or a workaround.
2. **Reproduce** with a real minimal `.qmd` document run through the dev build
   (`./package/dist/bin/quarto[.cmd]`), not a synthetic or contrived one. Capture actual vs.
   expected output.
3. **Encode the reproduction as a failing test** (smoke or smoke-all under `tests/` — see
   `.claude/rules/testing/overview.md` for how to run them; this skill doesn't restate that).
   Confirm it fails. The failing test is Phase 1's deliverable.
4. **Write down the root cause** — which layer, which code path, why — before moving on.

**STOP after step 4** once you have a documented root cause and a red test. Continue straight
into Phase 2 only if the request explicitly asked to find *and fix* the bug — otherwise stop,
full stop.

None of these justify continuing anyway:
- "The fix looks obvious" — obvious fixes still need the red test as evidence the diagnosis is
  right, not just plausible.
- "I'm confident in the root cause" — confidence isn't verification. The test is the evidence;
  without it you have a hypothesis, not a finding.
- "Stopping here feels like unnecessary ceremony" — it's the checkpoint before writing code, not
  busywork. The pause is what lets the root cause get reviewed before anything is built on it.

## Phase 2: fix

5. Design the fix. Discuss the approach briefly unless it is an obvious one-line change.
6. Implement. The failing test from Phase 1 must go green.
7. Add coverage for edge cases the original test doesn't reach.

If `superpowers:systematic-debugging` or `superpowers:test-driven-development` are available,
they pair well with this workflow, but neither is required to follow it.

## Investigation toolkit

Pick what fits — you rarely need all of these for one bug.

**Debug logging (try first).** `--log-level debug` works on `render`, `preview`, and `check`,
and often shows the exact call, path, or subprocess command involved before you add any
instrumentation of your own:

```bash
./package/dist/bin/quarto.cmd render document.qmd --log-level debug > debug.log 2>&1
```

For JSON-formatted output, filter with `jq`; otherwise `grep` the relevant section.

**Regression bisection.** When behavior changed between versions: build or install both
versions being compared (an older release plus the current dev build, or two tagged
checkouts), run the same input through each, and confirm the boundary. Then narrow with git:

```bash
git log v1.8.27..v1.9.0 -- src/path/to/suspect-file.ts   # commits that touched it
git diff v1.8.27..v1.9.0 -- src/path/to/suspect-file.ts  # what changed
```

Finding the exact commit is helpful but not required. It is enough to identify the problem
through code exploration and verify it by reproducing the behavior.

**Code path comparison.** Grep for the mechanism named in an error or debug log
(`grep -r "safeExec\|safe-exec" src/`), then `git log --all -- <file>` /
`git show <tag>:<file>` to see how it looked before and after a suspected change.

**Pandoc AST / Lua filter inspection.** For document-processing bugs (crossref, layout,
callouts, custom nodes):

```bash
./package/dist/bin/quarto.cmd dev-call show-ast-trace document.qmd
./package/dist/bin/quarto.cmd dev-call make-ast-diagram document.qmd
```

Add temporary `quarto.log()` calls in the relevant filter (`src/resources/filters/`) to trace
values across the pipeline.

**Intermediate output inspection.** Keep the output before the final compile step to see what
Quarto actually produced:

```yaml
keep-md: true    # markdown after code execution
keep-tex: true   # LaTeX before PDF compilation
keep-typ: true   # Typst source
```

```bash
./package/dist/bin/quarto.cmd render doc.qmd --to latex   # stop at .tex
./package/dist/bin/quarto.cmd render doc.qmd --to typst   # stop at .typ
```

**Windows-specific concerns.** Path encoding (UTF-8, code pages, 8.3 short names), generated
`.bat` wrapper files left in temp dirs, `cmd /c` wrapper vs. direct execution, and paths with
spaces or Unicode are common regression sources that don't show up on Linux/macOS CI.

**Cross-layer reasoning.** Quarto bugs often cross technology boundaries — TypeScript → Lua →
Pandoc → LaTeX/Typst. A symptom visible in one layer's output can originate in an earlier one;
when comparing working vs. broken, check the whole chain, not just where the symptom surfaced.

## Architecture context

Before non-trivial investigation in an unfamiliar subsystem, run `ls llm-docs/` and read the
matching file (e.g. `preview-architecture.md`, `sass-theming-architecture.md`) rather than
re-deriving the design from source. This skill doesn't duplicate that material.

## Verifying a hypothesis

Confirm by rendering a real document, not just by reading code:

```bash
./package/dist/bin/quarto.cmd render minimal-repro.qmd --log-level debug
```

Code inspection alone does not confirm a hypothesis.
