---
paths:
  - "src/resources/filters/**/*.lua"
  - "src/command/render/pandoc.ts"
  - "src/command/render/filters.ts"
---

# Passing Data from TypeScript to Lua Filters

Use `QUARTO_FILTER_PARAMS` / `param()` for internal filter data — not `format.metadata`.

`format.metadata` flows into Pandoc's metadata system (visible in templates via `$key$`, serialized to YAML). Internal filter configuration doesn't belong there. `param()` reads from a base64-encoded JSON env var decoded in `init.lua` — invisible to templates, no metadata pollution.

## Adding a new param

**From render pipeline** (cross-cutting concerns): set on `formatFilterParams` in `pandoc.ts` before `filterParamsJson()`:

```typescript
formatFilterParams["my-key"] = value;
```

**From format extras** (format-specific): return via `extras[kFilterParams]` from `formatExtras()` or `resolveExtras()`:

```typescript
extras[kFilterParams] = extras[kFilterParams] || {};
extras[kFilterParams]["my-key"] = value;
```

These merge into `formatFilterParams` at `pandoc.ts:954-958`.

**In Lua**: `param('my-key')` or `param('my-key', default)`.

## Key files

- `src/resources/pandoc/datadir/init.lua` — `param()` definition
- `src/command/render/filters.ts` — `filterParamsJson()` assembles all params
- `src/command/render/pandoc.ts:335` — encodes params to `QUARTO_FILTER_PARAMS` env var
- `src/config/constants.ts` — `kFilterParams` constant
