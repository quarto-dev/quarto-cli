# Lua Filter Bundling and the 200-Local-Variable Limit

## The mechanism

`main.lua` (`src/resources/filters/main.lua`) loads almost every filter file via
`import()`, a thin wrapper around `dofile()`:

```lua
function import(script)
  local path = PANDOC_SCRIPT_FILE:match("(.*[/\\])")
  dofile(path .. script)
end
```

In **dev mode**, each `import()`ed file is its own `dofile()` call — its own
independent Lua chunk, with its own local-variable scope. Nothing outside that
file can see its top-level `local`s; cross-file communication only works
through globals (`quarto`, `_quarto`) or `require()`'d modules.

For **distribution**, `package/src/common/package-filters.ts`'s `buildFilter()`
takes a different path: it parses the `-- [import] ... -- [/import]` block at
the top of `main.lua`, and **textually concatenates** every listed file's
source into one physical `main.lua`, verbatim, in order. This is a pure
string-join — it does not wrap each file's content in any scope. As a result:

- Every top-level `local` declared in **every** inlined file becomes part of
  **one single Lua chunk** (the "main function").
- Lua enforces a hard limit of 200 local variables per function
  (`MAXVARS` in Lua's compiler). Once the sum of all top-level locals across
  every inlined file exceeds 200, the packaged `main.lua` fails to even
  *compile*: `too many local variables (limit is 200) in main function`.
- Files loaded via `require()` (mostly things under `modules/`) are **not**
  affected — `require()` resolves at runtime to its own independent chunk,
  same in dev mode and in the packaged build.

This failure only surfaces in the **"Bundle Test" / `test-bundle` CI job**,
which builds and smoke-tests the packaged distribution. Every other CI job
runs dev-mode `quarto` directly against the source tree, where each file is
still its own `dofile()` chunk — so this class of bug is invisible until the
packaged-bundle build runs.

## Confirmed empirically (2026-07-16)

Using a standalone reimplementation of `buildFilter()` plus pandoc itself as
a compile oracle (`pandoc doc.md --lua-filter=inlined.lua`), we measured the
actual margin on `chore/pandoc-3.10`:

- At commit `e8921e613` (last known-good state): **199** top-level locals in
  the inlined chunk — one spare slot.
- Commit `08deb91d7` added four new call sites each declaring their own
  `local path = require("modules/path")` in four different `import()`ed
  files (`quarto-pre/book-links.lua`, `quarto-pre/project-paths.lua`,
  `quarto-post/typst-brand-yaml.lua`, `quarto-post/typst.lua`) — pushing the
  count to **203** and breaking the compile.

The codebase was already sitting at the edge (199/200) before this PR. This
is not a pandoc-3.10-specific problem — any future PR adding even one new
top-level local to an inlined file can trip it again.

### This has already recurred multiple times

- `c4d2198ad` (2023, PR #5146) — fixed by deleting one unused top-level local
  in `crossref/listings.lua`.
- `ae392ad23` (2026-03, open PR #14170) — fixed by moving typst annotation
  helpers out of an inlined file into a new `require()`-based
  `modules/typst-code-annotations.lua`.
- `514baffae` (2026-04, open PR #14312) — same pattern: moved
  `common/theorems.lua` logic into `modules/theorems.lua` behind `require()`.

Every prior fix has been an ad-hoc, per-offending-file stopgap. None
addressed the inliner itself. The problem has recurred at least three times
independently within a few weeks on unrelated branches — evidence the
stopgap approach doesn't scale as filter code accumulates.

## Fix patterns, in order of preference

1. **Use the existing `_quarto.modules` registry instead of a fresh
   `require()` alias.** `modules/import_all.lua` already centralizes most
   `modules/*` requires into one table (`_quarto.modules.constants`,
   `_quarto.modules.patterns`, `_quarto.modules.path`, etc.), assigned via a
   single **global** table constructor — which costs **zero** additional
   top-level locals no matter how many modules are registered in it. Any
   `import()`ed file that needs a module already in that registry should
   reference `_quarto.modules.<name>.<fn>(...)` directly instead of adding
   its own `local x = require("modules/<name>")`. This is the cheapest fix
   and requires no new file.

   Caution: many pre-existing call sites (`constants` alone is re-required
   as a fresh top-level local in ~10 different inlined files) do **not**
   follow this convention yet, despite the module already being registered.
   This is a large, low-risk cleanup opportunity — see "Known follow-up
   work" below.

2. **Move the logic into a `modules/*.lua` file loaded via `require()`.**
   This is what `ae392ad23` and `514baffae` did. It fully escapes the shared
   chunk (its own independent scope, same in dev and packaged builds) but
   costs a new file and a new `import_all.lua` (or ad-hoc `require()`)
   registration.

3. **(Not yet implemented) Wrap each inlined file's body in `do ... end`
   inside `buildFilter()`.** Verified empirically (2026-07-16, against Lua's
   actual reference-implementation source in `lparser.c`) that this is
   mechanically sound: Lua's compiler tracks *currently active* locals via
   `reglevel`, not a cumulative count, and `do...end` blocks trigger
   `leaveblock()` → `removevars()`, which rolls the active-local counter back
   to what it was at block entry. So each file's top-level locals go out of
   scope at that file's own `end`, freeing register slots for the next
   file — the 200-slot budget only needs to cover the single most
   local-heavy file, not the sum across all ~150 inlined files.

   This is the pattern real Lua bundlers (`amalg.lua`, `luabundle`) use —
   though they wrap in a full closure (`function() ... end`) rather than a
   plain block, because they additionally need `require()`/lazy-load/
   module-return semantics. Quarto's inliner doesn't need those semantics
   (it's linear, order-preserving script concatenation, not a module
   system), so a plain `do...end` wrapper is the minimal correct fix.

   Verified safe by construction: since dev-mode `dofile()` already
   isolates each file into its own chunk, no filter file can rely today on
   reading a *preceding* file's top-level local (that pattern would already
   be broken in dev mode). Wrapping each inlined segment in `do...end` for
   the packaged build only makes its scoping match dev-mode's existing
   isolation — it cannot introduce new incompatibilities, though it was
   only validated by compiling the wrapped bundle, not by running a full
   smoke suite against it.

## Known follow-up work (tracked separately, not urgent)

- Sweep the ~25+ pre-existing inlined call sites that redundantly
  `require()` a module already available via `_quarto.modules` (`constants`
  ×~10, `patterns` ×~6, `lightbox` ×2, others) to use the registry instead.
  Reclaims significant headroom; low risk, mechanical.
- Implement the `do...end` wrap in `buildFilter()` (fix pattern 3 above) as
  a permanent structural fix, with a full smoke-all run against the
  *packaged* bundle (not just a compile check) before merging.
- Given how often this recurs, once the process is well understood a
  dedicated skill or lint check (e.g. a CI step that runs the real
  `buildFilter()` + a pandoc compile-only check on every PR, rather than
  discovering the break only in the full packaged smoke-test job) would
  catch this class of regression immediately instead of ~20+ minutes into a
  CI run.
