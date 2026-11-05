---
paths:
  - "src/deno_ral/**/*.ts"
---

# Deno RAL (Runtime Abstraction Layer)

The `deno_ral/` directory provides a runtime abstraction layer over Deno's standard library. All code should import from here instead of directly from std.

## Available Modules

| Module        | Purpose                                  | Key exports                                                                                                                                                                                                                                                                                  |
| ------------- | ---------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `fs.ts`       | File system                              | `readTextFileSync`, `writeTextFileSync`, `statSync`, `readDirSync` (sorted), `removeSync`, `mkdirSync`, `copyFileSync`, `open`, `canonicalPathSync` (resolves symlinks), `existsSync`, `ensureDirSync`, `copySync`, `safeMoveSync`, `safeRemoveSync`; types `FileInfo`, `DirEntry`, `FsFile` |
| `temp.ts`     | Temp files/dirs (retry on AlreadyExists) | `makeTempDirSync`, `makeTempDir`, `makeTempFileSync`, `makeTempFile`; type `TempOptions`                                                                                                                                                                                                     |
| `errors.ts`   | Runtime-neutral error predicates         | `isNotFound`, `isAlreadyExists`, `isPermissionDenied`, `isAddrInUse`, `isConnectionRefused`, `isConnectionError`, `errorWithPath`                                                                                                                                                            |
| `path.ts`     | Path utilities                           | `join`, `dirname`, `basename`, `extname`                                                                                                                                                                                                                                                     |
| `log.ts`      | Logging                                  | `debug`, `info`, `warning`, `error`                                                                                                                                                                                                                                                          |
| `kv.ts`       | Deno KV cache stores                     | `openKv`, `getKv`, `kvOp`, `KvDamagedError`                                                                                                                                                                                                                                                  |
| `platform.ts` | Platform detection                       | `isWindows`                                                                                                                                                                                                                                                                                  |
| `process.ts`  | Process execution                        | Process utilities                                                                                                                                                                                                                                                                            |

## Why Use deno_ral

- Consistent API across the codebase
- Abstraction allows future runtime changes
- Import map resolution works correctly
- Avoids scattered `jsr:/@std/*` imports

## Common Utilities

**Temp files** (`src/core/temp.ts`):

```typescript
import { createTempContext } from "../core/temp.ts";

const temp = createTempContext();
try {
  const tempFile = temp.createFile({ suffix: ".json" });
} finally {
  temp.cleanup();
}
```

**Process execution** (`src/core/process.ts`):

```typescript
import { execProcess } from "../core/process.ts";

const result = await execProcess({
  cmd: ["pandoc", "--version"],
  stdout: "piped",
});
```

## Safe File Operations

`deno_ral/fs.ts` provides safe wrappers over raw Deno APIs. Prefer these:

- **`safeMoveSync(src, dest)`** — Use instead of `Deno.renameSync`. Handles cross-device moves by falling back to copy+delete on `EXDEV` errors.
- **`safeRemoveSync(path, options)`** — Use instead of `Deno.removeSync`. Tolerates already-removed paths (no error if file doesn't exist).
- **`safeRemoveDirSync(path, boundary)`** — Safe recursive removal that refuses to delete outside the boundary directory.

## Module Loading Order

`src/quarto.ts` loads monkey patches first:

```typescript
import "./core/deno/monkey-patch.ts"; // Must be first!
```

This ensures compatibility shims load before any code runs.

## Moving code off `Deno.*`

Outside `deno_ral/`, never add new `Deno.*` calls; import the equivalent from `deno_ral/`. The `deno_ral/` modules themselves implement those functions with `Deno.*`. To migrate existing files mechanically:

    quarto run --dev tools/codemod-deno-ral.ts --rules fs,temp --dir src/<dir> --dry-run
    quarto run --dev tools/codemod-deno-ral.ts --rules fs,temp --dir src/<dir>

The tool reports local-name collisions (left as `Deno.*`; fix with an alias import such as `import { stat as fsStat } ...`, which later runs reuse) and skips files that assign to `Deno.*`, `src/core/lib` and the standalone scripts. Replace `instanceof Deno.errors.X` with the predicates in `deno_ral/errors.ts`. After a rebase conflict in a codemodded file, reset the file to `main` and re-run the codemod; never resolve by hand. `--reverse` produces the `Deno.*` form for backports (`dev-docs/checklist-backport-a-pr.md`).
