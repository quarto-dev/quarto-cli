# Follow-up: run the julia-engine subtree tests in binary mode

Status: **planned follow-up** (upstream change required). Companion to
`dev-docs/ci-test-log-grouping-design.md` (where the gap was found) and
`llm-docs/built-version-testing-architecture.md` (the binary-mode
architecture and its D3/D4 env-leak trap).

## Current state: gated out of binary mode

`.github/actions/merge-extension-tests` skips copying the julia-engine
subtree tests into `tests/` when `QUARTO_TEST_BIN` is set (with a
`::notice::` in the CI log). Dev-mode runs are unaffected — the tests still
run in every dev shard. Remove that gate as the last step of this plan.

## The bug being avoided

`smoke/julia-engine/{julia,render}.test.ts` come from the
`PumasAI/quarto-julia-engine` subtree
(`src/resources/extension-subtrees/julia-engine/tests/`) and are
self-contained: `jsr:` imports only, and they spawn quarto with raw
`new Deno.Command("quarto"| "quarto.cmd")` — PATH lookup plus the **fully
inherited environment**, bypassing the harness's `runQuarto()` dispatch.

In binary mode the workflow prepends the built quarto to PATH, so the right
binary runs — but it inherits the dev env that `run-tests.[sh|ps1]` exports
for the harness process:

- `QUARTO_DEBUG=true` → the built quarto takes the dev-only
  `checkReconfiguration()` branch (`src/quarto.ts`) →
  `readSourceDevConfig()` reads `<root>/configuration`, which does not exist
  outside the checkout → `NotFound: readfile '/home/runner/work/configuration'`
  (the failure observed in the first long built-version runs, 2026-07-20).
- Even without the crash, leaked `QUARTO_SHARE_PATH`/`DENO_DIR`/... would
  make the built quarto silently use dev-tree resources — the exact D3/D4
  trap `llm-docs/built-version-testing-architecture.md` documents, already
  fixed for the playwright wrapper via `quartoSpawnEnvOptions()`.

## Why there is no clean quarto-cli-side fix

Evaluated and rejected:

1. **Edit the copied tests here** — forbidden: subtree files are pulled from
   the upstream repo (single source of truth); local edits are lost or
   conflict on the next `pull-git-subtree` (`.claude/rules/extension-subtrees.md`).
2. **Patch the files during the `merge-extension-tests` copy** — a sed-style
   fork of upstream code inside a composite action; drift-prone and worse
   than the gate.
3. **Stop exporting the dev vars in binary mode (`run-tests.[sh|ps1]`)** —
   relitigates settled decision D4: the *harness* process needs the dev-tree
   env in all modes; only spawned children must be sanitized.
4. **A `quarto` shim earlier in PATH that `env -u`-strips and execs the real
   binary** — needs a `.cmd` twin for Windows, hides the real defect, and
   makes PATH resolution in CI even harder to reason about.

The spawn site is the only correct place to sanitize, and the spawn site
lives upstream.

## Upstream fix (PumasAI/quarto-julia-engine)

The tests cannot import `tests/quarto-cmd.ts` (they must stay
self-contained), so they get a small local helper, e.g. `tests/spawn-env.ts`
in the subtree repo:

```ts
// Env vars exported by quarto-cli's run-tests.[sh|ps1] for the dev-tree
// harness. They must not reach a spawned quarto under test: QUARTO_DEBUG
// triggers dev-only reconfiguration checks and the path vars make an
// installed quarto silently use dev-tree resources.
// Mirrors kStripEnvVars in quarto-cli tests/quarto-cmd.ts — keep in sync.
const kStripEnvVars = [
  "QUARTO_SHARE_PATH",
  "QUARTO_BIN_PATH",
  "QUARTO_DEBUG",
  "DENO_DIR",
  "QUARTO_DENO",
  "QUARTO_DENO_DOM",
  "QUARTO_ROOT",
  "QUARTO_SRC_PATH",
  "QUARTO_FORCE_VERSION",
  "QUARTO_VERSION_REQUIREMENT",
  "QUARTO_PROJECT_DIR",
  "QUARTO_PROFILE",
  "QUARTO_LOG",
  "QUARTO_LOG_LEVEL",
  "QUARTO_LOG_FORMAT",
  "RSTUDIO",
];

export function quartoSpawnOptions(): { env: Record<string, string>; clearEnv: boolean } {
  const env = { ...Deno.env.toObject() };
  for (const name of kStripEnvVars) delete env[name];
  return { env, clearEnv: true };
}
```

Then every `new Deno.Command(quartoCmd(), { ... })` in
`tests/smoke/julia-engine/*.test.ts` adds `...quartoSpawnOptions()` to its
options. `clearEnv: true` + explicit env matches `quartoSpawnEnvOptions()`
semantics in quarto-cli (the sanitized env is authoritative). Stripping
unconditionally is fine — in dev mode the dev quarto re-derives these from
its own launcher, which is how a user shell invokes it anyway.

Sync rule: the list mirrors `kStripEnvVars` in quarto-cli
`tests/quarto-cmd.ts`. If a var is added there, add it upstream too (the
comment in both files points each way).

## Procedure

1. Open the upstream PR in `PumasAI/quarto-julia-engine` (helper + spawn
   sites; their CI runs against a pinned quarto-cli rev and stays green —
   the change is a no-op in dev mode).
2. After upstream merge, in quarto-cli:
   `quarto dev-call pull-git-subtree julia-engine` (adds two commits; never
   edit or rebase them — `.claude/rules/extension-subtrees.md`).
3. Remove the `QUARTO_TEST_BIN` gate (and its TODO comment) from
   `.github/actions/merge-extension-tests/action.yml`.
4. Verify: dispatch `test-smokes-built.yml` with `source=build`; the smoke
   leg must now run `smoke/julia-engine/*` and pass. Also confirm one dev
   shard still runs them (no regression from the helper in dev mode).

## Acceptance criteria

- Binary-mode smoke leg runs the julia-engine tests green (no
  `checkReconfiguration` crash, no dev-tree resource use — spot-check the
  child's reported share path if in doubt).
- Dev shards unchanged.
- Gate and TODO removed; this doc updated to Status: done (or deleted, with
  the sync rule moved to `llm-docs/built-version-testing-architecture.md`).
