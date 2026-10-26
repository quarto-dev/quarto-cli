---
main_commit: 4aa86e524
analyzed_date: 2026-05-20
key_files:
  - src/core/config.ts
  - src/config/metadata.ts
  - src/core/language.ts
  - src/project/project-context.ts
  - src/command/render/render-contexts.ts
  - src/command/render/defaults.ts
---

# Configuration and metadata merging

How Quarto deep-merges nested config trees — Pandoc defaults,
`format.metadata`, `format.language`, `variables`, project YAML.
Required reading before adding any helper that combines multiple
sources of structured config.

## TL;DR

```
mergeConfigs              (src/core/config.ts)
  └─► lodash.mergeWith + mergeArrayCustomizer (array union-concat, dedup)
        ▲
        ├── mergeConfigsCustomized           (src/config/metadata.ts)
        │     └─► caller-supplied per-key customizer, then array customizer
        │             ▲
        │             ├── mergeFormatMetadata   (kTblColwidths, kVariant,
        │             │                          kCodeLinks/kOtherLinks)
        │             └── mergeProjectMetadata  (string-vs-string contents:)
        └── (call directly for plain nested merges with leaf-key precedence)
```

Never reach for raw `lodash.merge` or `Object.assign` for nested
configuration. Shallow spread `{ ...a, ...b }` is **only** safe when both
sides are flat records and you have verified there are no shared keys
that hold nested objects.

## The canonical primitive: `mergeConfigs`

`src/core/config.ts:10` exports `mergeConfigs<T>(config: T, ...configs: Array<unknown>): T`.
Wraps `lodash.mergeWith` with `mergeArrayCustomizer` and deep-clones every
input before merging (non-mutating).

```ts
// usage shape
const merged = mergeConfigs(defaults, userOverrides);
```

**Semantics**

- Objects: recursively deep-merged. Nested maps survive when not overridden
  on the same path.
- Scalars (string, number, boolean, null): last-in wins on collision.
- Arrays: **union-concat with dedup by `JSON.stringify`** (not last-in
  wins). Functions in arrays are kept and each given a fresh
  `crypto.randomUUID()` key to bypass dedup. This is the lodash-uncommon
  behavior — it surprises people coming from `_.merge`.
- Inputs are deep-cloned before merging — argument objects are not
  mutated.

**Array-replacement (rather than union)** requires going through
`mergeConfigsCustomized` with a per-key customizer that returns
`srcValue` for the keys you want to replace. See `mergeFormatMetadata`
handling of `kTblColwidths` for an in-tree example.

## Format-level: `mergeFormatMetadata`

`src/config/metadata.ts:266` wraps `mergeConfigsCustomized` for `Format`
objects (the `.pandoc`, `.metadata`, `.language`, `.render`, `.execute`,
etc. subtrees on a per-format basis).

Adds three semantics on top of `mergeConfigs`:

- `kTblColwidths`: `srcValue` always wins (replace, not array union).
- `kVariant`: Pandoc extension strings (`+yaml_metadata_block-tex_math_dollars`)
  are merged via a dedicated extension-aware combiner so partial overrides
  do not lose previously-enabled extensions.
- `kCodeLinks` / `kOtherLinks` (`kBooleanDisableArrays`): explicit `false`
  becomes an empty array (the disable signal), not the default array-union.

Use this — not raw `mergeConfigs` — anywhere two `Format` objects need to
combine (project default + directory `_metadata.yml` + document
frontmatter).

## Project-level: `mergeProjectMetadata`

`src/config/metadata.ts:294` wraps `mergeConfigsCustomized` for the project
config tree. Adds one rule:

- `contents` key holding a string: `srcValue` replaces. Avoids spurious
  concat of glob-string lists (`["docs/*"]` merged with `["src/*"]` would
  produce `["docs/*", "src/*"]` under the default array-union, often
  unintended for `contents:`).

Reach for this when merging project YAML layers (project root, parent
project, includes).

## The escape hatch: `mergeConfigsCustomized`

`src/config/metadata.ts:317` —
`mergeConfigsCustomized<T>(customizer, config, ...configs): T`.

Use directly only when none of the named wrappers fit. The customizer
runs first; return `srcValue` (or `objValue`, or a computed value) to
short-circuit, or return `undefined` to fall through to
`mergeArrayCustomizer` and then to lodash's default object recursion.

## In-tree call sites (representative)

| Site | What's merged |
|---|---|
| `src/core/language.ts:formatLanguage` | `_language.yml` defaults ← user-supplied `language:` block. Same FormatLanguage shape Quarto exposes under `$quarto.language.<key>$`. |
| `src/project/project-context.ts:resolveLanguageTranslations` | Project `kLanguageDefaults` ← `translations.language` (user overrides win on project language defaults). |
| `src/command/render/render-contexts.ts:resolveFormats` | Three-layer `mergeFormatMetadata(projFormat, directoryFormat, inputFormat)` — project / `_metadata.yml` / frontmatter, leaf-key precedence. |
| `src/command/render/defaults.ts:generateDefaults` | `variables.quarto.*` builder output ← user-supplied `variables.quarto.*` escape hatch. Internal namespace; user-set leaf keys win at any depth. |
| `src/command/render/pandoc.ts` | Multiple layered metadata merges across format / theme / extension contributions. |

## Common pitfalls

- **Shallow spread silently drops nested keys.** `{ ...a, ...b }` where
  both have `b.language` → `a.language` is dropped entirely. Tests that
  only probe the overridden leaf pass under this bug; the dropped sibling
  keys silently resolve empty downstream. The fix is `mergeConfigs(a, b)`.
- **Array-union, not replacement.** A list-typed config key (filter
  chain, contents glob list, format list) under `mergeConfigs` will grow
  on each merge rather than replace. If replacement is intended, route
  through `mergeConfigsCustomized` and return `srcValue` for that key,
  or use the named wrapper that already does it (see
  `mergeFormatMetadata` / `kTblColwidths`).
- **Order matters: defaults first, user last.** `mergeConfigs(defaults, user)`
  — last argument wins on scalar collision. Reversing the argument order
  silently makes Quarto-shipped defaults win over user values, which
  almost never the intended direction.
- **Non-plain-object src values.** Passing a string, number, or array as
  a sibling source to `mergeConfigs` exercises lodash's surprising
  behavior of iterating the value's enumerable index keys. Guard with
  `ld.isPlainObject(value)` before passing user-controlled values from
  YAML.
- **`mergeFormatMetadata` is not `mergeConfigs`.** It deep-clones, merges
  arrays the same way, **and** layers extra rules. If you are merging
  `Format` objects, use the named wrapper — don't drop down to
  `mergeConfigs` and re-invent the extra semantics.

## Adding a new merge wrapper

Only justified when there is a per-key behavior that none of the
existing wrappers handle. Steps:

1. Add an export to `src/config/metadata.ts` (the natural home for
   merge wrappers).
2. Wrap `mergeConfigsCustomized` with a customizer that handles the
   per-key rule and returns `undefined` for everything else.
3. Add a unit test in `tests/unit/` covering: the new per-key rule
   (positive), a non-affected key (regression — confirms the default
   `mergeConfigs` behavior still flows through), and an empty/undefined
   input (resilience).
4. Update this doc with the new wrapper row.
