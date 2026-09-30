---
main_commit: 9b307f7db
analyzed_date: 2026-09-30
key_files:
  - src/project/project-context.ts
  - src/command/command-utils.ts
  - src/command/check/cmd.ts
  - src/command/check/check.ts
  - src/execute/engine.ts
  - src/core/cache/cache.ts
  - src/project/types/single-file/single-file.ts
---

# Project Context Resolution

How Quarto finds the project for a path, resolves its configuration, and
discovers its input files. Two layers: `resolveProjectConfig()` (config only)
and `projectContext()` (config + `ProjectContext` + input walk), both in
`src/project/project-context.ts`.

## Root discovery

`resolveProjectConfig(dir, extensionContext?, flags?)` runs two resolver
passes, each walking upward from `dir` (`dir = dirname(dir)`) until it
matches or hits the filesystem root:

1. **`_quarto.yml` pass** — `quartoYamlProjectConfigResolver()` reads and
   validates `_quarto.yml` (plus `metadata-files` includes). A
   `PermissionDenied` while probing a dir for `_quarto.yml` is swallowed
   (#5843), so an unreadable ancestor doesn't stop the upward search.
2. **Extension detector pass** — only if pass 1 found nothing.
   `projectExtensionsConfigResolver()` collects `project.detect` file sets
   from extensions (loaded relative to the starting dir) and restarts the
   upward walk from the original dir looking for a dir containing one set.
   The result is a synthesized `{ project: { type } }` config with no file.

The nearest `_quarto.yml` wins, so a stray `~/_quarto.yml` makes every path
under `~` a project rooted at `~` (#14960).

## `resolveProjectConfig()` — config only

After a resolver matches, the rest of the config pipeline runs in order:
legacy migration, project-type extension (+ its includes), engine
extensions (`resolveEngineExtensions`), profiles, `.env` files (sets env
vars), `_variables.yml`, language translations, `--to` format injection,
then `project:` normalization (output-dir from flags, pre/post-render to
arrays, type default `lib-dir`/`output-dir`, output-dir `.`/absolute
normalization).

Returns `ProjectConfigResolution | undefined`:

| Field | Meaning |
|-------|---------|
| `dir` | Project root |
| `config` | Fully resolved `ProjectConfig` |
| `configFile` | The `_quarto.yml` that set the root, or `null` when the root came from the extension detector pass |
| `configFiles` | Every config file read (`_quarto.yml` first, then includes, profiles, dotenv, vars, translations); becomes `files.config` on the context |

It does not walk input files, create `.quarto`, or open any handle.
`type.config()` hooks (book, website, manuscript) are **not** applied here:
they need a `ProjectContext` and may read project files. None of them touch
`engines`.

### Callers

- `projectContext()` — always, then builds the full context.
- `initializeProjectContextAndEngines()` (`src/command/command-utils.ts`) —
  used by `quarto check`, `quarto create`, `quarto create-project` and
  `quarto call engine`. Only needs `config.engines` for `resolveEngines()`
  (`src/execute/engine.ts`), so it wraps the result as a minimal
  `{ dir, config }` context, or falls back to `zeroFileProjectContext()`
  (bundled engine extensions only) when no project is found. It returns the
  `ProjectConfigResolution` (or `undefined`); `quarto check` passes it into
  `check()`, and `check info` reports `dir`/`configFile` (JSON
  `info.project`, `null` outside a project) and warns when the root is the
  home dir or a filesystem root. The other callers ignore it.

## `projectContext()` — full context and input walk

`projectContext(path, notebookContext, renderOptions?, force?)` calls
`resolveProjectConfig()` from `path` (or its dir), then:

- **Project found, `config.project` set** — builds the `ProjectContext`
  (temp context and disk cache under `<dir>/.quarto`), applies
  `type.config()`, walks inputs, then applies the membership check below.
- **Project found, no `project` key** — same context without type hooks.
- **No project, `force`** — synthetic project at the original dir, see
  `llm-docs/synthetic-project-context.md`.
- **No project** — returns `undefined`; callers fall back to
  `singleFileProjectContext()`.

`mergeExtensionMetadata()` runs on the returned context only when
`renderOptions` is passed.

### Input walk

`projectInputFiles()` → `projectInputFilesInternal()` first calls
`resolveEngines(project)` (so external engines' ignore dirs apply), then:

- With `project.render` globs: resolves only those globs, excluding the
  hidden-ignore globs and output dir.
- Otherwise `addDir(dir)`: std `walk` over the whole root,
  `followSymlinks: false`.

Two filtering mechanisms with different cost:

| Mechanism | Applies to | Effect |
|-----------|------------|--------|
| `skip` (pruned, never read) | dot-dirs (`kSkipHidden`), `engineIgnoreDirs()`: `node_modules` plus each engine's `ignoreDirs()` (knitr: `renv`, `packrat`, `rsconnect`; jupyter: `venv`, `env`) | Walk does not descend |
| Post-filter on yielded files | `projectHiddenIgnoreGlob()`: `_*`, `.*`, README, CLAUDE/AGENTS md, `*.llms.md` | Dir is fully traversed, files discarded |

So `_site`, `_freeze`, `_extensions` and any `_dir` are read in full. std
`walk` has no error hook: an unreadable dir anywhere under the root throws
`Deno.errors.PermissionDenied` out of `projectContext()`.

`addDir` tags that `PermissionDenied` (the same error object, message and
stack untouched) with the project dir; `projectContext()` adds the
`configFile` from `resolveProjectConfig()` on its throw path. The forced
synthetic branch leaves `configFile` unset. `frameInputWalkError()` turns a
tagged error with a `configFile` into one `ErrorEx` without stack: the Deno
message (it carries the `readdir '<path>'`, reused verbatim), the project
root, the `_quarto.yml` that set it, and a hint that the file may be
accidental. Any other error is returned unchanged. Only `quarto render` and
`quarto preview` frame, by wrapping their actions in
`withInputWalkErrorFraming()` (`src/command/command-utils.ts`); `inspect` and
other walkers still report the raw error.

### File-membership fallback

When `path` is a file and not in the walked inputs (e.g. `_partial.qmd`, or
a file under an ignored dir), `projectContext()` returns `undefined` and the
caller treats the file as single-file. Membership is decided by the full
walk, so rendering one file still pays for walking the whole project.

## `.quarto` disk cache lifecycle

Each built context opens a `Deno.Kv` disk cache via `createProjectCache()`
(`src/core/cache/cache.ts`) under `<dir>/.quarto` (synthetic: under the temp
dir) and a temp context. `returnResult()` registers `context.cleanup` with
`onCleanup()`, which closes the cache at process exit.

If anything throws after the context is built (`type.config()`, the input
walk, `mergeExtensionMetadata()`), each branch calls `context.cleanup()`
before rethrowing, so the cache is closed and the temp dir removed right
away.

The membership fallback returns `undefined` **after** creating the cache,
without calling cleanup: the handle stays open for the process lifetime
(not fixed yet). On Windows the project dir then cannot be removed
in-process (os error 32). Any new early return after the context is built
must close `diskCache` and clean `temp`.

## Which commands pay for the walk

| Walks inputs (`projectContext`) | Config only (`resolveProjectConfig`) |
|---------------------------------|--------------------------------------|
| `render`, `preview`, `serve`, `inspect`, `publish`, `list`, `remove`, `use binder`, `use brand`, extension install | `check`, `create`, `create-project`, `call engine` |

Config-only commands neither walk inputs nor create `<root>/.quarto`.
