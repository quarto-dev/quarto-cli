# Lua Type Stubs Guide

## Purpose

The `src/resources/lua-types/` directory contains Lua Language Server (LuaLS) type annotation stubs. They serve two purposes:

1. **VS Code IDE intellisense** — `.luarc.json` at the repo root sets `Lua.workspace.library` to this directory, giving developers autocomplete, hover docs, and type checking when editing Lua filters.
2. **Auto-generated API documentation** — The quarto-web repo (PR quarto-dev/quarto-web#1649) runs `lua-language-server --doc` on these stubs to produce the Lua API reference at `docs/lua/` on quarto.org.

These files contain **no runtime logic** — they are pure `---@meta` annotation files read only by the Lua Language Server.

## Directory Structure

```
src/resources/lua-types/
├── lpeg.lua              # LPeg pattern matching library
├── re.lua                # LPeg re module
├── text.lua              # Pandoc UTF-8 text module
├── pandoc/               # Pandoc Lua API stubs
│   ├── README.md         # Tracks sync state with upstream pandoc
│   ├── blocks.lua, inlines.lua, ...
│   └── utils.lua, path.lua, ...
└── quarto/               # Quarto public Lua API stubs
    ├── quarto.lua         # Top-level quarto table (quarto.version)
    ├── doc.lua            # quarto.doc.*
    ├── format.lua         # quarto.format.*
    ├── format/
    │   ├── typst.lua      # quarto.format.typst.*
    │   └── typst_css.lua  # quarto.format.typst.css.*
    ├── utils.lua          # quarto.utils.*
    ├── log.lua            # quarto.log.*
    ├── project.lua        # quarto.project.*
    ├── config.lua         # quarto.config.*
    ├── brand.lua          # quarto.brand.*
    ├── json.lua           # quarto.json.*
    ├── base64.lua         # quarto.base64.*
    ├── paths.lua          # quarto.paths.*
    ├── metadata.lua       # quarto.metadata.*
    ├── variables.lua      # quarto.variables.*
    ├── shortcode.lua      # quarto.shortcode.*
    ├── callout.lua        # quarto.Callout constructor
    ├── tabset.lua         # quarto.Tabset, quarto.Tab constructors
    └── customnodes.lua    # Other custom node constructors
```

## Public vs Internal API

The distinction is simple:

- **`quarto.*`** (defined in `init.lua:812+`) = **public API** — must have stubs in `lua-types/quarto/`
- **`_quarto.*`** (defined in `init.lua:734`) = **internal API** — no stubs (used only by Quarto's own filters)

Some public API is lazily injected in `main.lua` rather than `init.lua` because it depends on filter infrastructure:
- `quarto.doc.file_metadata` (main.lua:215)
- `quarto.utils.file_metadata_filter` (main.lua:210)
- `quarto.utils.combineFilters` (main.lua:211)
- `quarto.brand` (import_all.lua:28)
- `quarto.format.typst` (quarto-post/typst.lua:10 via shared table)
- Custom node constructors like `quarto.Callout`, `quarto.Tabset` (customnodes.lua:449)

These are all available when extension filters run and should have stubs.

## Runtime Source Mapping

Each stub file corresponds to a runtime implementation:

| Stub file | Runtime source |
|-----------|---------------|
| `quarto/doc.lua` | `pandoc/datadir/init.lua` (doc block, lines 814-959) |
| `quarto/format.lua` | `pandoc/datadir/_format.lua` |
| `quarto/utils.lua` | `pandoc/datadir/init.lua` (utils block) + `pandoc/datadir/_utils.lua` |
| `quarto/log.lua` | `pandoc/datadir/logging.lua` |
| `quarto/project.lua` | `pandoc/datadir/init.lua` (project block, lines 960-965) |
| `quarto/config.lua` | `pandoc/datadir/init.lua` (config block, lines 998-1001) |
| `quarto/brand.lua` | `filters/modules/brand/brand.lua` |
| `quarto/json.lua` | `pandoc/datadir/_json.lua` |
| `quarto/base64.lua` | `pandoc/datadir/_base64.lua` |
| `quarto/paths.lua` | `pandoc/datadir/init.lua` (paths block, lines 981-992) |
| `quarto/metadata.lua` | `pandoc/datadir/init.lua` (metadata block, lines 1033-1037) |
| `quarto/variables.lua` | `pandoc/datadir/init.lua` (variables block, lines 1038-1046) |
| `quarto/shortcode.lua` | `pandoc/datadir/init.lua` (shortcode block, lines 1002-1031) |
| `quarto/format/typst.lua` | `filters/modules/typst.lua` |
| `quarto/format/typst_css.lua` | `filters/modules/typst_css.lua` |
| `quarto/callout.lua` | `filters/customnodes/callout.lua` |
| `quarto/tabset.lua` | `filters/customnodes/panel-tabset.lua` |
| `quarto/customnodes.lua` | Individual files in `filters/customnodes/` |

## Annotation Format

Stubs use LuaLS EmmyLua annotations:

```lua
---@meta                          -- marks file as type-only (no runtime)

--[[
Multi-line doc comment shown in hover and autogen docs.
]]
---@param name type Description
---@param optional? type Optional parameter
---@return type Description
function quarto.module.func(name, optional) end

---@type type                     -- for fields/properties
quarto.module.field = default

---@alias TypeName { field: type } -- type alias
---@class ClassName               -- class definition
---@field name type               -- class field
```

## Maintenance Workflow

When adding or changing a public Lua API function:

1. **Edit the runtime implementation** in the appropriate source file
2. **Update the corresponding stub** in `src/resources/lua-types/quarto/`
3. **Verify**: param names/types, return types, and doc comments match the implementation
4. **Check exports**: if adding a new function, ensure it's in the runtime's return/export table

When updating Pandoc stubs (after a Pandoc version bump):
- Follow the checklist in `dev-docs/update-pandoc-checklist.md`
- Inspect the diff of Pandoc's `lua-filters.md` for API changes
- Update `src/resources/lua-types/pandoc/README.md` with the synced commit

## Naming Conventions

From `dev-docs/internals-guide/pandoc/lua-filters.qmd`:
- `snake_case` for function names
- `lowercase` for filenames
- CamelCase only for constructor functions (`quarto.Callout`, `quarto.Tabset`)

Legacy camelCase aliases (e.g., `isLatexOutput`, `addHtmlDependency`) exist at runtime for backwards compatibility but are not documented in stubs.

## Distribution

The lua-types directory is included in Quarto's installed `share/` directory. The Quarto VS Code extension points users' `.luarc.json` files at this installed copy, giving extension authors the same intellisense as Quarto developers.
