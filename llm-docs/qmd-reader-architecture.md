---
main_commit: b2602e390
analyzed_date: 2026-05-29
key_files:
  - src/resources/pandoc/datadir/readqmd.lua
  - src/resources/filters/qmd-reader.lua
  - src/command/render/pandoc.ts
  - src/resources/filters/mainstateinit.lua
  - src/resources/filters/crossref/refs.lua
---

# The qmd Custom Reader (Pre-Parse Stage)

Quarto reads `.qmd`/`.md` input through a **custom Pandoc reader written in Lua**,
not through Pandoc's stock Markdown reader directly. This reader is the only place
in the pipeline that sees the raw document text *before* Pandoc parses it into an
AST. Anything that must influence how Pandoc parses the document — as opposed to how
the parsed AST is transformed — has to happen here.

The filter-system documentation (`.claude/rules/filters/overview.md`) describes the
pipeline starting at the INIT stage, which runs *after* parsing. This document covers
the stage *before* that: raw text in, Pandoc AST out.

## Where it sits

```
raw .qmd text
   │
   ▼
qmd custom reader  (readqmd.lua)        ← raw-text transforms, then pandoc.read
   │
   ▼
Pandoc AST
   │
   ▼
filter pipeline  (INIT → NORMALIZE → PRE → CROSSREF → … )   ← main.lua
```

## Wiring

The reader is installed **unconditionally** for every Pandoc invocation Quarto makes.
In `src/command/render/pandoc.ts`, just before Pandoc runs:

```ts
// set up the custom .qmd reader
if (allDefaults.from) {
  formatFilterParams["user-defined-from"] = allDefaults.from;
}
allDefaults.from = resourcePath("filters/qmd-reader.lua");
```

The user's original `from` value (e.g. `markdown+extension`) is preserved as the
`user-defined-from` filter param so the reader can still honor requested extensions;
the actual `--from` handed to Pandoc becomes the Lua reader.

`src/resources/filters/qmd-reader.lua` is a thin entry point that delegates to
`readqmd`:

```lua
local readqmd = require("readqmd")

function Reader (inputs, opts)
  local result = readqmd.readqmd(tostring(inputs), opts)
  result.meta.quarto_pandoc_reader_opts = readqmd.options_to_meta(opts)
  return result
end
```

## What `readqmd()` does

`src/resources/pandoc/datadir/readqmd.lua` is the substance. Its flow:

1. **Raw-text transforms** (string in, string out) run on the document text:
   - `md_fenced_div.attempt_to_fix_fenced_div(txt)` — fenced div (`:::`) repairs.
   - `escape_invalid_tags(txt)` — see "the escape-then-restore pattern" below.
   - `md_shortcode.parse_md_shortcode_2(txt)` — encodes shortcodes (`{{< … >}}`) to a
     UUID-tagged hex form so Pandoc passes them through untouched.
2. **`pandoc.read(txt, flavor, opts)`** parses the now-safe text into an AST.
   *After this call, the document is an AST and the raw text is gone.*
3. **A post-parse `:walk`** restores everything that was encoded in step 1 — decoding
   the shortcode UUIDs back to their original text inside `Str`, `Code`, `RawInline`,
   `RawBlock`, `Math`, link targets, image sources, and attributes, and restoring
   escaped tags inside `CodeBlock`.

## The escape-then-restore pattern (reusable technique)

The central technique this reader uses: **transform raw text so Pandoc parses it the
way Quarto wants, then undo the transform on the AST afterward.** Pandoc's own parse
is used to tell Quarto which regions are verbatim (code, math, raw), so the reader
does not have to re-implement code/prose detection in raw text.

Two existing instances:

- **Invalid fenced-code tags.** `escape_invalid_tags` finds ```` ```{…} ```` fence
  openers whose info string would confuse Pandoc (e.g. inside pipe tables) and replaces
  the tag with a random placeholder string. After parsing, `unescape_invalid_tags`
  restores the original tag text inside `CodeBlock` nodes.
- **Shortcodes.** Shortcodes are hex-encoded behind a fixed UUID sentinel
  (`b58fc729-690b-4000-b19f-365a4093b2ff;<hex>;`) before parsing, then decoded in the
  post-parse walk. This keeps Pandoc from interpreting shortcode contents as Markdown.

**When to reach for this pattern:** a Pandoc *parsing* behavior is wrong for Quarto and
cannot be repaired on the AST because the parse has already discarded the information
you need. Escape in raw text before `pandoc.read`; restore on the AST after, scoping the
restore to the node types where the escape would otherwise leak (`CodeBlock`, `Code`,
`Math`, `RawBlock`, `RawInline`).

### Worked case: example-list collision (issue #14557, not implemented)

`(@eq-equation)` at the **start of a block** is parsed by Pandoc's `example_lists`
extension as an ordered-list item, not a cross-reference — and the label is consumed as
a list marker, so no Lua filter ever sees the reference. This is a pure parser behavior:
unfixable on the AST (the label is gone), and not disableable without losing example
lists. The only feasible intervention is in this reader: escape the parentheses of a
block-start `(@<reserved-crossref-prefix>-…)` to `\(@…\)` before `pandoc.read`, then
restore the literal `(@…)` inside verbatim nodes in the walk.

This case is **deferred, not implemented** (see the issue). It is documented here because
it is a clean illustration of both the pattern and its limits: the code/math/raw
classification can be delegated to Pandoc's post-parse AST, but deciding *which line-start
positions* would have become example lists is a heuristic — there is no parser at this
layer. The heuristic degrades gracefully (over-escaping renders identically; under-escaping
leaves the original behavior with no regression), but it is best-effort by nature.

## The separate-context constraint

The custom reader **runs in a different Lua interpreter context than the main filter
chain.** `qmd-reader.lua` notes this directly: it cannot share global state with the
filters, so it injects reader options into the document metadata
(`quarto_pandoc_reader_opts`) for the filters to pick up later.

Practical consequences when writing reader-stage code:

- **Filter-stage global state does not exist yet.** `crossref.categories` (built in
  `mainstateinit.lua` and consumed by `crossref/refs.lua`'s `valid_ref_types()`),
  custom crossref categories, and other filter globals are unavailable. The full set of
  valid cross-reference types is only assembled at runtime in the main filter context.
- **`param(...)` works.** Filter params set via `formatFilterParams` in `pandoc.ts`
  (e.g. `user-defined-from`) are readable in the reader with `param(...)`. This is the
  channel for handing the reader information that TypeScript already knows.
- **Reaching for "all reserved crossref prefixes" is not free.** The built-in prefixes
  are scattered (`src/config/constants.ts` TS constants, `customnodes/theorem.lua`
  theorem types, `mainstateinit.lua` float/callout categories) and only unified at
  runtime by `valid_ref_types()` — which the reader cannot call. Code needing that list
  at read time must either pass it in as a param from TypeScript or share a static
  source module across contexts.

## Pointers

- `src/resources/pandoc/datadir/readqmd.lua` — the reader implementation.
- `src/resources/filters/qmd-reader.lua` — entry point / context note.
- `src/command/render/pandoc.ts` — where the reader is wired (`allDefaults.from`).
- `.claude/rules/filters/overview.md` — the post-parse filter pipeline (the stage after this one).
- `.claude/rules/filters/lua-development.md` — Lua coding conventions.
