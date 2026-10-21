# PR 17: `deno_ral/watch.ts`; polling watcher and serve watcher on it

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task.
> Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add `src/deno_ral/watch.ts` (`FsEvent`, `FsWatcher`, `watchFs`) on `Deno.watchFs`, and retype the three consumers (`src/core/quarto.ts`, `src/core/watch.ts`, `src/project/serve/watch.ts`) so no `Deno.watchFs`/`Deno.FsEvent` remains outside the layer.
**Phase:** 1.
**Depends on:** PR 09 (`src/deno_ral/temp.ts`; `fs.ts` `canonicalPathSync`, `writeTextFileSync`, `removeSync`), PR 14b (`tests/smoke/preview/preview-reload.test.ts`), PR 02 (ratchet; `tests/asserts.ts`).
**Unblocks:** PR 25, PR 29.
**Branch:** `rt/17-ral-watch`.
**Suggested executor:** Sonnet.
One small module, one kind-mapping, three type edits; mechanical once the interface is fixed.
**Size:** S.
1 new module, 1 new test, 3 modified source files, baseline, rules doc.
**Ships on:** Deno; the existing test suite must stay green.

## Spec

### Context

Assessment section 3.3 lists `Deno.watchFs`/`Deno.FsEvent` as used by `src/core/quarto.ts`, `src/core/watch.ts` and `src/project/serve/watch.ts`; Node replacement is `fs.watch({ recursive: true })` (Linux support since Node 20) or `@parcel/watcher`.
Section 11 module plan row `watch.ts`: own `FsEvent` type; `core/watch.ts` (polling watcher) and `project/serve/watch.ts` adopt it.

Verified sites (`main` at `b86f98d`):

- `src/core/quarto.ts:94`: `const watcher = Deno.watchFs([srcDir], { recursive: true });` inside `previewMonitorResources`, dev-mode only (`quartoConfig.isDebug()`), iterating `event.paths` and looking for `.ts` changes to terminate the preview.
  It is the only native watcher.
- `src/core/watch.ts:12,14`: `export interface PollingFsWatcher extends AsyncIterable<Deno.FsEvent> { close; [Symbol.asyncIterator](): AsyncIterableIterator<Deno.FsEvent> }`; `watchForFileChanges` yields `{ kind: "create" | "modify", paths }` by polling mtimes.
  It never calls `Deno.watchFs`.
- `src/project/serve/watch.ts:110`: `handleWatchEvent = async (event: Deno.FsEvent)`; it reads `event.paths` and checks `["modify", "create"].includes(event.kind)` (line 128).
  The watcher it consumes (line 342) is `watchForFileChanges`.
- `src/command/preview/preview.ts:678-683` consumes `watchForFileChanges` and checks `event.kind === "modify"`; no `Deno.` reference, compiles unchanged once `PollingFsWatcher` yields `FsEvent`.

So the serve and preview watchers are polling and only emit `create`/`modify`; rename/remove semantics of the native watcher matter to no consumer today.
Deno's `FsEvent.kind` is `"any" | "access" | "create" | "modify" | "rename" | "remove" | "other"`.
The layer's `FsEvent.kind` (vocabulary) is `"create" | "modify" | "remove" | "rename" | "other"`; `"any"` and `"access"` map to `"other"`.

Coverage: `tests/smoke/preview/preview-reload.test.ts` (PR 14b) edits a document under `quarto preview` and waits for `reload`, which goes through `watchForFileChanges` → `PollingFsWatcher` → `preview.ts:678-683`.
The native watcher in `quarto.ts` is dev-mode only and checked manually (Task 2 step 4).

### Scope

In: `watch.ts`, its unit test, the three consumers, baseline, rules table.
Out: `Deno.statSync` at `src/core/watch.ts:39,74` and `Deno.readTextFileSync` at `src/project/serve/watch.ts:138,192` (PR 10/PR 12 codemods).
The polling strategy of `watchForFileChanges` (unchanged; it stays a polling watcher because inotify limits and network drives made native watching unreliable for project inputs).

### Interfaces

`src/deno_ral/watch.ts` (new):

```ts
/*
 * watch.ts
 *
 * Copyright (C) 2026 Posit Software, PBC
 *
 * File-system change notifications. The only module that may call
 * Deno.watchFs. PR 29 reimplements it on node:fs.watch.
 */

export interface FsEvent {
  kind: "create" | "modify" | "remove" | "rename" | "other";
  /** Absolute paths, as the OS reports them (symlinks in the watched
   * directory's own path may be resolved, e.g. /private/var on macOS). */
  paths: string[];
}

export interface FsWatcher extends AsyncIterable<FsEvent> {
  /** Stops the watcher; the async iteration ends after pending events. Idempotent. */
  close(): void;
}

/** Watches `paths` (files or directories). `recursive` defaults to true, as
 * in Deno. Throws if a path does not exist. */
export function watchFs(
  paths: string[],
  options?: { recursive?: boolean },
): FsWatcher;
```

`src/core/watch.ts` (changed type only):

```ts
import { FsEvent, FsWatcher } from "../deno_ral/watch.ts";
export type PollingFsWatcher = FsWatcher;
export function watchForFileChanges(files: string[] | (() => string[]), pollingInterval?: number): PollingFsWatcher;
```

`src/project/serve/watch.ts` (changed type only): `handleWatchEvent = async (event: FsEvent)`.

### Files

- Create: `src/deno_ral/watch.ts`.
- Create: `tests/unit/ral/watch.test.ts`.
- Modify: `src/core/quarto.ts:94` (+ import).
- Modify: `src/core/watch.ts:7-15,87-99`.
- Modify: `src/project/serve/watch.ts:38,110` (+ import).
- Modify: `tools/runtime-boundary-baseline.json`, `.claude/rules/typescript/deno-ral.md`.

### Acceptance criteria

- `grep -rn 'Deno\.watchFs\|Deno\.FsEvent\|Deno\.FsWatcher' src tests package --include=*.ts | grep -v '^src/deno_ral/' | grep -v extension-subtrees` prints nothing.
- `grep -n 'Deno\.' tests/unit/ral/watch.test.ts` prints nothing.
- `cd tests && QUARTO_TESTS_NO_CONFIG=true ./run-tests.sh --agent unit/ral/watch.test.ts` passes on Linux, macOS and Windows CI.
- `cd tests && QUARTO_TESTS_NO_CONFIG=true ./run-tests.sh --agent smoke/preview/preview-reload.test.ts` passes (polling watcher path; ignored on Windows).
- Baseline for `src` lower by 4 (`quarto.ts:94` call, `core/watch.ts:12,14` and `serve/watch.ts:110` type references), committed.

## Plan

### Task 1: `watch.ts` with its unit test

**Files:**
- Create: `src/deno_ral/watch.ts`
- Create: `tests/unit/ral/watch.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
/*
 * watch.test.ts
 *
 * Copyright (C) 2026 Posit Software, PBC
 *
 * Compatibility contract for src/deno_ral/watch.ts (rerun by PR 29 on Node).
 */

import { assert, assertEquals } from "../../asserts.ts";
import { unitTest } from "../../test.ts";
import { FsEvent, watchFs } from "../../../src/deno_ral/watch.ts";
import { join, SEP } from "../../../src/deno_ral/path.ts";
import {
  canonicalPathSync,
  removeSync,
  writeTextFileSync,
} from "../../../src/deno_ral/fs.ts";
import { makeTempDirSync } from "../../../src/deno_ral/temp.ts";

const kEventTimeoutMs = 5000;

// Collects events until `done(event)` returns true, or fails after a timeout.
async function collectUntil(
  watcher: AsyncIterable<FsEvent>,
  done: (ev: FsEvent) => boolean,
): Promise<FsEvent[]> {
  const seen: FsEvent[] = [];
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(
      () =>
        reject(
          new Error(
            `no matching fs event within ${kEventTimeoutMs}ms; saw ${JSON.stringify(seen)}`,
          ),
        ),
      kEventTimeoutMs,
    );
  });
  const loop = (async () => {
    for await (const ev of watcher) {
      seen.push(ev);
      if (done(ev)) return seen;
    }
    return seen;
  })();
  return Promise.race([loop, timeout]).finally(() => clearTimeout(timer));
}

const kinds: FsEvent["kind"][] = ["create", "modify", "remove", "rename", "other"];

unitTest("watch - create and modify in a watched directory produce events with absolute paths", async () => {
  // Watch the canonical path: macOS FSEvents reports /private/var/... for a
  // /var/... temp dir, and Windows may hand out an 8.3 short temp path.
  const dir = canonicalPathSync(makeTempDirSync({ prefix: "quarto-watch-test" }));
  const target = join(dir, "a.txt");
  const watcher = watchFs([dir], { recursive: true });
  try {
    // Native watchers register asynchronously; give the OS a moment.
    await new Promise((r) => setTimeout(r, 200));
    writeTextFileSync(target, "one");
    const created = await collectUntil(
      watcher,
      (ev) => ev.paths.some((p) => p.endsWith("a.txt")),
    );
    for (const ev of created) {
      assert(kinds.includes(ev.kind), `unexpected kind ${ev.kind}`);
      for (const p of ev.paths) {
        assert(
          p === dir || p.startsWith(dir + SEP),
          `path ${p} is not an absolute path under ${dir}`,
        );
      }
    }
    writeTextFileSync(target, "one two three");
    const modified = await collectUntil(
      watcher,
      (ev) => ev.kind === "modify" && ev.paths.some((p) => p.endsWith("a.txt")),
    );
    assert(modified.length > 0);
  } finally {
    watcher.close();
    removeSync(dir, { recursive: true });
  }
});

unitTest("watch - close ends the iteration and is idempotent", async () => {
  const dir = makeTempDirSync({ prefix: "quarto-watch-close" });
  const watcher = watchFs([dir]);
  try {
    const iteration = (async () => {
      let n = 0;
      for await (const _ of watcher) n++;
      return n;
    })();
    watcher.close();
    watcher.close();
    let timer: ReturnType<typeof setTimeout> | undefined;
    const n = await Promise.race([
      iteration,
      new Promise<number>((_, reject) => {
        timer = setTimeout(
          () => reject(new Error("iteration did not end after close")),
          kEventTimeoutMs,
        );
      }),
    ]).finally(() => clearTimeout(timer));
    assertEquals(typeof n, "number");
  } finally {
    removeSync(dir, { recursive: true });
  }
});

unitTest("watch - watching a missing path throws", async () => {
  let threw = false;
  try {
    watchFs([join(makeTempDirSync({ prefix: "quarto-watch-missing" }), "nope")]);
  } catch {
    threw = true;
  }
  assert(threw);
  await Promise.resolve();
});
```

(The last test leaves an empty temp directory; the OS temp cleanup removes it.
It uses a path under a fresh temp dir so it is missing on every OS, including Windows where `/definitely/...` is drive-relative.)

- [ ] **Step 2: Run it and see it fail**

Run: `cd tests && QUARTO_TESTS_NO_CONFIG=true ./run-tests.sh --agent unit/ral/watch.test.ts` Expected: type-check error `Module not found "file:///.../src/deno_ral/watch.ts"`.

- [ ] **Step 3: Implement `watch.ts`**

```ts
/*
 * watch.ts
 *
 * Copyright (C) 2026 Posit Software, PBC
 *
 * File-system change notifications. The only module that may call
 * Deno.watchFs. PR 29 reimplements it on node:fs.watch; the exported types
 * and tests/unit/ral/watch.test.ts are the contract.
 */

export interface FsEvent {
  kind: "create" | "modify" | "remove" | "rename" | "other";
  paths: string[];
}

export interface FsWatcher extends AsyncIterable<FsEvent> {
  close(): void;
}

function mapKind(kind: Deno.FsEvent["kind"]): FsEvent["kind"] {
  switch (kind) {
    case "create":
    case "modify":
    case "remove":
    case "rename":
      return kind;
    default:
      // "any", "access" and future kinds
      return "other";
  }
}

export function watchFs(
  paths: string[],
  options: { recursive?: boolean } = {},
): FsWatcher {
  const watcher = Deno.watchFs(paths, { recursive: options.recursive ?? true });
  let closed = false;
  return {
    close: () => {
      if (closed) return;
      closed = true;
      try {
        watcher.close();
      } catch {
        // already closed
      }
    },
    async *[Symbol.asyncIterator]() {
      try {
        for await (const event of watcher) {
          yield { kind: mapKind(event.kind), paths: event.paths };
        }
      } catch (e) {
        // Deno throws BadResource when the watcher is closed mid-iteration.
        if (!closed) throw e;
      }
    },
  };
}
```

- [ ] **Step 4: Run the test**

Run: `cd tests && QUARTO_TESTS_NO_CONFIG=true ./run-tests.sh --agent unit/ral/watch.test.ts` Expected: `...` then `ok | 3 passed | 0 failed`.
On macOS the first event for a new file may be `create` followed by `modify`; the test tolerates either order.

- [ ] **Step 5: Commit**

```bash
git add src/deno_ral/watch.ts tests/unit/ral/watch.test.ts
git commit -m "deno_ral: add watch.ts (watchFs, FsEvent, FsWatcher) with unit test"
```

### Task 2: Consumers

**Files:**
- Modify: `src/core/quarto.ts:94`
- Modify: `src/core/watch.ts:7-15,87-99`
- Modify: `src/project/serve/watch.ts:38,110`

- [ ] **Step 1: `src/core/quarto.ts`**

Add to the imports at the top of the file:

```ts
import { watchFs } from "../deno_ral/watch.ts";
```

Replace line 94:

```ts
    const watcher = watchFs([srcDir], { recursive: true });
```

- [ ] **Step 2: `src/core/watch.ts` lines 7–15**

```ts
import { existsSync } from "../deno_ral/fs.ts";
import { error } from "../deno_ral/log.ts";
import { FsEvent, FsWatcher } from "../deno_ral/watch.ts";

import { sleep } from "./async.ts";

// A watcher that polls mtimes instead of using native notifications; same
// shape as deno_ral/watch.ts FsWatcher so consumers accept either.
export type PollingFsWatcher = FsWatcher;
```

(Keep any other import the file has today; `grep -n '^import' src/core/watch.ts` before and after.)
In the generator body (lines 87–99) annotate the yielded literals so the narrowed kind type-checks:

```ts
          if (created.length > 0) {
            yield { kind: "create", paths: created } as FsEvent;
          }
          if (modified.length > 0) {
            yield { kind: "modify", paths: modified } as FsEvent;
          }
```

- [ ] **Step 3: `src/project/serve/watch.ts`**

After line 38 (`import { watchForFileChanges } ...`):

```ts
import { FsEvent } from "../../deno_ral/watch.ts";
```

Line 110:

```ts
    event: FsEvent,
```

- [ ] **Step 4: Type-check and run the consumers' tests**

Run: `cd src && ../package/dist/bin/tools/x86_64/deno check --unstable-kv --import-map=import_map.json quarto.ts` Expected: exit 0.

Run: `cd tests && QUARTO_TESTS_NO_CONFIG=true ./run-tests.sh --agent smoke/preview/preview-reload.test.ts unit/preview-compatibility.test.ts` Expected: `ok | N passed | 0 failed`.

Manual (dev-mode src watcher, the one native watcher): `package/dist/bin/quarto preview tests/docs/smoke-all/2023/05/24/5657-raw.qmd --no-browser`, then `touch src/core/watch.ts`; the preview prints `quarto src code changed: preview terminating` and exits with code 1 (the pre-existing behaviour of `terminatePreview`).

- [ ] **Step 5: Commit**

```bash
git add src/core/quarto.ts src/core/watch.ts src/project/serve/watch.ts
git commit -m "watchers typed with deno_ral/watch FsEvent; src watcher on watchFs"
```

### Task 3: Ratchet and docs

- [ ] **Step 1:** `quarto run --dev tools/check-runtime-boundary.ts --update-baseline` → `src` count lower by 4 (1 call, 3 type references); `tests` unchanged.
- [ ] **Step 2:** Add to `.claude/rules/typescript/deno-ral.md` module table:

```markdown
| `watch.ts` | File-system change events | `watchFs`, `FsEvent`, `FsWatcher` |
```

- [ ] **Step 3: Commit**

```bash
git add tools/runtime-boundary-baseline.json .claude/rules/typescript/deno-ral.md
git commit -m "ratchet baseline after watch.ts; document watch.ts"
```

## Verification

- `cd tests && QUARTO_TESTS_NO_CONFIG=true ./run-tests.sh --agent unit/ral/watch.test.ts` → `ok | 3 passed | 0 failed`.
- `cd tests && QUARTO_TESTS_NO_CONFIG=true ./run-tests.sh --agent smoke/preview/preview-reload.test.ts unit/preview-compatibility.test.ts` → pass.
- `quarto run --dev tools/check-runtime-boundary.ts` → passes at the new baseline.
- Manual dev-mode src watcher check (Task 2 step 4).

## Review checklist

- [ ] `watchFs` default `recursive` is `true` (Deno's default), so `core/quarto.ts` behaviour is unchanged.
- [ ] Kind mapping covers `"any"` and `"access"` → `"other"`; no consumer branches on those.
- [ ] `close()` idempotent; iteration ends without throwing after close.
- [ ] `PollingFsWatcher` is a type alias, so `preview.ts:678` and `serve/watch.ts:342` compile unchanged.
- [ ] The path assertion compares against `canonicalPathSync(dir)` with a separator, so it fails for a relative or foreign path (the first draft's `|| p.includes("a.txt")` made it pass for any path).
- [ ] Test files use `deno_ral` temp/fs and `tests/asserts.ts`; no `Deno.`; temp dirs removed even on failure.

## Risks and rollback

- The unit test depends on OS notification latency; the 5 s timeout and the 200 ms registration delay follow what Deno's own `watchFs` tests use.
  If it flakes on CI macOS, raise `kEventTimeoutMs` to 10000 rather than disabling the test (see `dev-docs/debugging-flaky-tests.md`).
- Phase 2: `fs.watch` recursive on Deno has an open issue (denoland/deno#36937: a watcher reopened on a recreated directory gets no events); Spike #2 covers it.
  The polling watchers that serve and preview use are unaffected.
- Rollback: revert three commits.

## Decisions needed

None.
