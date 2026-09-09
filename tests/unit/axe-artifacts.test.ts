/*
 * axe-artifacts.test.ts
 *
 * Where `quarto call axe` writes its summary artifacts, and which ones it
 * clears before scanning. The rule these pin down: a previous run's report
 * must never survive an aborted scan to be read as the current one — and
 * `--report` moves the report, so it moves what has to be cleared.
 *
 * Copyright (C) 2026 Posit Software, PBC
 */

import { unitTest } from "../test.ts";
import { assert, assertEquals } from "testing/asserts";
import { join, resolve } from "../../src/deno_ral/path.ts";
import { withTempDir } from "../utils.ts";
import {
  effectiveReportFile,
  reportDestinationError,
  staleArtifacts,
} from "../../src/command/call/axe/cmd.ts";

const kOutputDir = join(resolve("_site"), "_axe-checks");

unitTest(
  "axe artifacts - --report moves the report out of the artifact dir",
  // deno-lint-ignore require-await
  async () => {
    assertEquals(
      effectiveReportFile(kOutputDir, undefined),
      join(kOutputDir, "report.md"),
    );
    // resolved against the working directory, like any user-supplied path
    assertEquals(
      effectiveReportFile(kOutputDir, "docs/a11y.md"),
      resolve("docs/a11y.md"),
    );
  },
);

unitTest(
  "axe artifacts - a custom --report destination is cleared before scanning",
  // deno-lint-ignore require-await
  async () => {
    const custom = effectiveReportFile(kOutputDir, "docs/a11y.md");
    const cleared = staleArtifacts(kOutputDir, custom);

    // the run is about to claim this path: an abort must not leave the
    // previous scan's report sitting there, read as this one's
    assert(
      cleared.includes(custom),
      "the custom report destination is not cleared",
    );
    // and the default location still is, because a previous run without
    // --report wrote there
    assert(
      cleared.includes(join(kOutputDir, "report.md")),
      "the default report location is not cleared",
    );
    assert(
      cleared.includes(join(kOutputDir, "findings.json")),
      "findings.json is not cleared",
    );
  },
);

unitTest(
  "axe artifacts - a directory --report destination is a usage error",
  async () => {
    await withTempDir((dir) => {
      // Cleanup removes the report destination before scanning. Deno.removeSync
      // deletes an empty directory outright and throws on a non-empty one, so
      // a directory here would either be silently replaced by a file or crash
      // the command. Neither is acceptable: reject it as the flag mistake it
      // is, before anything is removed.
      const emptyDir = join(dir, "reports");
      Deno.mkdirSync(emptyDir);
      const emptyError = reportDestinationError(emptyDir);
      assert(
        emptyError !== undefined,
        "an empty directory destination must be rejected",
      );
      assert(
        emptyError!.includes("directory"),
        `the message must say why: ${emptyError}`,
      );
      assert(
        Deno.statSync(emptyDir).isDirectory,
        "validation must not have removed the directory",
      );

      const fullDir = join(dir, "occupied");
      Deno.mkdirSync(fullDir);
      Deno.writeTextFileSync(join(fullDir, "keep.txt"), "keep");
      assert(
        reportDestinationError(fullDir) !== undefined,
        "a non-empty directory destination must be rejected",
      );

      // a plain file, and a path that doesn't exist yet, are both fine
      const file = join(dir, "a11y.md");
      Deno.writeTextFileSync(file, "# previous report");
      assertEquals(reportDestinationError(file), undefined);
      assertEquals(reportDestinationError(join(dir, "new/a11y.md")), undefined);
    });
  },
);

unitTest(
  "axe artifacts - the default run lists each path once",
  // deno-lint-ignore require-await
  async () => {
    const cleared = staleArtifacts(
      kOutputDir,
      effectiveReportFile(kOutputDir, undefined),
    );
    assertEquals(
      cleared.length,
      new Set(cleared).size,
      "the default report path is listed twice",
    );
  },
);
