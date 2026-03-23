/*
 * file-permissions.test.ts
 *
 * Copyright (C) 2020-2026 Posit Software, PBC
 */

import { unitTest } from "../test.ts";
import { withTempDir } from "../utils.ts";
import { assert, assertEquals } from "testing/asserts";
import { join } from "../../src/deno_ral/path.ts";
import { isWindows } from "../../src/deno_ral/platform.ts";
import {
  ensureUserWritable,
  safeModeFromFile,
} from "../../src/deno_ral/fs.ts";

function writeFile(dir: string, name: string, content: string, mode: number): string {
  const path = join(dir, name);
  Deno.writeTextFileSync(path, content);
  Deno.chmodSync(path, mode);
  return path;
}

unitTest(
  "file-permissions - ensureUserWritable fixes read-only files",
  async () => withTempDir((dir) => {
    const file = writeFile(dir, "readonly.txt", "test content", 0o444);

    const modeBefore = safeModeFromFile(file);
    assert(modeBefore !== undefined);
    assert((modeBefore! & 0o200) === 0, "File should be read-only before fix");

    ensureUserWritable(file);

    assertEquals(safeModeFromFile(file), 0o644,
      "Mode should be exactly 0o644 (0o444 | 0o200) — only user write bit added");
  }),
  { ignore: isWindows },
);

unitTest(
  "file-permissions - ensureUserWritable leaves writable files unchanged",
  async () => withTempDir((dir) => {
    const file = writeFile(dir, "writable.txt", "test content", 0o644);
    const modeBefore = safeModeFromFile(file);
    assert(modeBefore !== undefined, "Mode should be readable");

    ensureUserWritable(file);

    assertEquals(safeModeFromFile(file), modeBefore,
      "Mode should be unchanged for already-writable file");
  }),
  { ignore: isWindows },
);

// Simulates the Nix/deb scenario: Deno.copyFileSync from a read-only source
// preserves the read-only mode on the copy. ensureUserWritable must fix it.
unitTest(
  "file-permissions - copyFileSync from read-only source then ensureUserWritable",
  async () => withTempDir((dir) => {
    const src = writeFile(dir, "source.lua", "-- filter code", 0o444);

    // Copy it (this is what quarto create does internally)
    const dest = join(dir, "dest.lua");
    Deno.copyFileSync(src, dest);

    // Without the fix, dest inherits 0o444 from src
    const modeBefore = safeModeFromFile(dest);
    assert(modeBefore !== undefined);
    assert((modeBefore! & 0o200) === 0, "Copied file should inherit read-only mode from source");

    // Make source writable so cleanup succeeds
    Deno.chmodSync(src, 0o644);

    ensureUserWritable(dest);

    assertEquals(safeModeFromFile(dest), 0o644,
      "Copied file should be user-writable after ensureUserWritable");
  }),
  { ignore: isWindows },
);
