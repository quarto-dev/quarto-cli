/*
 * axe-artifacts.test.ts
 *
 * Where `quarto call axe` writes its summary artifacts, and which ones it
 * clears before scanning. The rule these pin down: a previous run's default
 * report must never survive an aborted scan to be read as the current one.
 * A `--report` destination is a user-chosen path outside the artifact
 * directory, so it is overwritten at write time instead of cleared upfront.
 *
 * Copyright (C) 2026 Posit Software, PBC
 */

import { unitTest } from "../test.ts";
import { assert, assertEquals } from "testing/asserts";
import { join, resolve } from "../../src/deno_ral/path.ts";
import { isMac, isWindows } from "../../src/deno_ral/platform.ts";
import { withTempDir } from "../utils.ts";
import {
  effectiveReportFile,
  reportDestinationError,
  reservedArtifacts,
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
  "axe artifacts - a custom --report destination is not cleared",
  // deno-lint-ignore require-await
  async () => {
    const custom = effectiveReportFile(kOutputDir, "docs/a11y.md");
    const cleared = staleArtifacts(kOutputDir);

    // the destination is the user's path, not this command's to delete —
    // the report write overwrites it at the end of the run instead
    assert(
      !cleared.includes(custom),
      "the custom report destination should not be cleared",
    );
    // the default location is still cleared, because a previous run
    // without --report wrote there
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
      // The report write throws when the destination is a directory, and it
      // happens at the end of an otherwise complete scan. Reject it up front
      // as the flag mistake it is, instead of crashing after all the work.
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
  "axe artifacts - --report can't target a file the scan itself owns",
  // deno-lint-ignore require-await
  async () => {
    // Cleanup runs before the baseline is read (cmd.ts). --report pointed at
    // the baseline's own path would delete the hand-written ledger before it
    // is loaded, then leave a markdown report sitting where the ledger used
    // to be — silently discarding every accepted finding. findings.json and
    // README.md are the same hole one step later: the scan writes real
    // content to each of them, and a --report collision means the markdown
    // report overwrites one, or is itself silently overwritten by one.
    const baselineFile = resolve("_axe-baseline.json");
    const reserved = reservedArtifacts(kOutputDir, baselineFile);

    for (const path of reserved) {
      const collisionError = reportDestinationError(path, reserved);
      assert(
        collisionError !== undefined,
        `--report ${path} must be rejected as an axe-owned path`,
      );
    }

    // an ordinary destination, including the default report.md itself,
    // stays fine
    assertEquals(
      reportDestinationError(join(kOutputDir, "report.md"), reserved),
      undefined,
    );
    assertEquals(
      reportDestinationError(resolve("docs/a11y.md"), reserved),
      undefined,
    );
  },
);

unitTest(
  "axe artifacts - a differently-cased --report destination collides where the platform default filesystem is case-insensitive",
  // deno-lint-ignore require-await
  async () => {
    // Windows and macOS's default volume format are case-insensitive but
    // case-preserving, so "_AXE-BASELINE.JSON" and "_axe-baseline.json" name
    // the same file there; on a case-sensitive filesystem they genuinely
    // don't, and rejecting the second one would block a legitimate distinct
    // destination. No files are created here: the check is a pure function of
    // the two paths and the platform, not of what's on disk right now.
    const baselineFile = resolve("_axe-baseline.json");
    const differentCase = resolve("_AXE-BASELINE.JSON");
    const result = reportDestinationError(differentCase, [baselineFile]);
    if (isWindows || isMac) {
      assert(
        result !== undefined,
        "on this platform's default filesystem the two paths name the " +
          "same file; the guard must reject the collision",
      );
    } else {
      assertEquals(
        result,
        undefined,
        "on a case-sensitive filesystem these are genuinely different " +
          "paths; the guard must not reject a distinct destination",
      );
    }
  },
);

unitTest(
  "axe artifacts - --report can't target the managed cells directory",
  async () => {
    await withTempDir(async (dir) => {
      const outputDir = join(dir, "_axe-checks");
      const cellsDir = join(outputDir, "cells");
      Deno.mkdirSync(cellsDir, { recursive: true });

      // A cell the previous scan wrote — this run would regenerate it while
      // scanning, then silently overwrite it with markdown once the report
      // is written, corrupting a raw per-cell axe payload.
      const existingCell = join(cellsDir, "index__1440x900__light.json");
      Deno.writeTextFileSync(existingCell, "{}");
      assert(
        reportDestinationError(existingCell, [], cellsDir) !== undefined,
        "an existing cell file must be rejected as a --report destination",
      );

      // Not yet written this run, but still inside the directory the scan
      // owns — rejected on location, not on prior existence.
      const notYetWrittenCell = join(cellsDir, "about__320x568__dark.json");
      assert(
        reportDestinationError(notYetWrittenCell, [], cellsDir) !== undefined,
        "a not-yet-written path inside cells/ must still be rejected",
      );

      // Nested deeper than a direct child. cells/ is flat today, but the
      // documented contract is that nothing inside it is a destination, and
      // ensureDirSync would create the intermediate directory on the way.
      const nested = join(cellsDir, "archive", "report.md");
      assert(
        reportDestinationError(nested, [], cellsDir) !== undefined,
        "a path nested below cells/ must be rejected",
      );

      // Elsewhere in the artifact dir is fine.
      assertEquals(
        reportDestinationError(join(outputDir, "a11y.md"), [], cellsDir),
        undefined,
      );

      // A sibling whose name merely starts with the cells directory's is
      // outside it: containment, not a string prefix.
      assertEquals(
        reportDestinationError(join(outputDir, "cells-old.md"), [], cellsDir),
        undefined,
      );
    });
  },
);

unitTest(
  "axe artifacts - the default run lists each path once",
  // deno-lint-ignore require-await
  async () => {
    const cleared = staleArtifacts(kOutputDir);
    assertEquals(
      cleared.length,
      new Set(cleared).size,
      "the default report path is listed twice",
    );
  },
);
