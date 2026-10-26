---
paths:
  - "src/**/*.ts"
---

# Config and metadata merging

When merging nested config-like objects (Pandoc defaults, `variables`,
`metadata`, `format.language`, `format.pandoc`, project YAML), use the
canonical in-tree helpers — never raw `lodash.merge` or shallow spread.

| Helper | File | Use when |
|---|---|---|
| `mergeConfigs<T>(config, ...configs): T` | `src/core/config.ts` | General nested-object merge. Deep-merges objects; **arrays union-concat with dedup by `JSON.stringify`** (not last-wins); scalars last-wins. Deep-clones inputs. |
| `mergeFormatMetadata<T>(config, ...configs): T` | `src/config/metadata.ts` | Format-level objects (`.pandoc`, `.metadata`, `.language`, `.render`). Adds `kTblColwidths` replace, `kVariant` pandoc-extension merge, and `kCodeLinks`/`kOtherLinks` `false→[]` semantics on top of `mergeConfigs`. |
| `mergeProjectMetadata<T>(config, ...configs): T` | `src/config/metadata.ts` | Project YAML trees. Adds string-vs-string replace for `contents:` to avoid spurious glob concat. |
| `mergeConfigsCustomized<T>(customizer, config, ...configs): T` | `src/config/metadata.ts` | Escape hatch — supply a per-key customizer that runs before `mergeArrayCustomizer`. |

Shallow `{ ...a, ...b }` is correct **only** when both sides are flat
records with no shared keys that hold nested objects. If `a.x` and `b.x`
are both objects you want their leaves merged, reach for `mergeConfigs`.

The array-union default surprises people. Want arrays to replace?
`mergeConfigsCustomized` with a customizer that returns `srcValue` for
the specific key (see how `mergeFormatMetadata` handles `kTblColwidths`).

Architectural reference: `llm-docs/config-merging.md`.
