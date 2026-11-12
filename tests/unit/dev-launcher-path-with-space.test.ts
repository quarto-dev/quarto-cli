/*
 * dev-launcher-path-with-space.test.ts
 *
 * The dev launcher package/dist/bin/quarto.cmd must work when the checkout
 * path contains a space.
 *
 * Copyright (C) 2026 Posit Software, PBC
 */

import { unitTest } from "../test.ts";
import { assert, assertEquals } from "../asserts.ts";
import { isWindows } from "../../src/deno_ral/platform.ts";
import { dirname, fromFileUrl, join } from "../../src/deno_ral/path.ts";
import {
  existsSync,
  readTextFileSync,
  removeSync,
  writeTextFileSync,
} from "../../src/deno_ral/fs.ts";
import { execProcess } from "../../src/core/process.ts";
import { withTempDir } from "../utils.ts";

const repoRoot = join(dirname(fromFileUrl(import.meta.url)), "..", "..");
const denoVersionFile = join(repoRoot, "package", "dist", "config", "deno-version");

// The DENO version from the `configuration` file, which win_configuration.bat
// exports and the launcher records in config/deno-version.
function configuredDenoVersion(): string {
  const configuration = readTextFileSync(join(repoRoot, "configuration"));
  const match = configuration.match(/^export DENO=(\S+)/m);
  assert(match, "DENO not found in configuration");
  return match[1];
}

unitTest(
  "dev-launcher - quarto.cmd runs from a checkout path containing a space",
  async () => {
    const denoVersionBefore = existsSync(denoVersionFile)
      ? readTextFileSync(denoVersionFile)
      : undefined;
    await withTempDir(async (dir) => {
      const junction = join(dir, "with space");
      const mklink = await execProcess({
        cmd: "cmd",
        args: ["/c", "mklink", "/J", junction, repoRoot],
        stdout: "piped",
        stderr: "piped",
      });
      assert(mklink.success, `creating the junction failed: ${mklink.stderr}`);
      try {
        const result = await execProcess({
          cmd: join(junction, "package", "dist", "bin", "quarto.cmd"),
          args: ["--help"],
          cwd: dir,
          stdout: "piped",
          stderr: "piped",
          env: {
            QUARTO_NO_TYPECHECK: "true",
            // A failed launch can reach the stale-Deno branch, which runs
            // `call configure.cmd` from the checkout root. Disabling
            // current-directory command lookup keeps it from reconfiguring
            // the checkout under test.
            NoDefaultCurrentDirectoryInExePath: "1",
          },
        });
        const stdout = result.stdout ?? "";
        const stderr = result.stderr ?? "";
        const denoVersionAfter = existsSync(denoVersionFile)
          ? readTextFileSync(denoVersionFile)
          : undefined;
        // configure.cmd writes the file after installing Deno; the launcher
        // must leave it holding the configured version.
        assertEquals(
          denoVersionAfter?.trim(),
          configuredDenoVersion(),
          "config/deno-version does not hold the configured Deno version",
        );
        assert(
          result.success && stdout.includes("Usage:"),
          `quarto.cmd --help failed (exit ${result.code})\nstdout:\n${stdout}\nstderr:\n${stderr}`,
        );
      } finally {
        // Restore a deno-version the launcher may have corrupted, then remove
        // the junction itself (not its target) before the temp dir goes.
        if (denoVersionBefore !== undefined) {
          writeTextFileSync(denoVersionFile, denoVersionBefore);
        } else if (existsSync(denoVersionFile)) {
          removeSync(denoVersionFile);
        }
        removeSync(junction);
      }
    });
  },
  { ignore: !isWindows, requiresDevQuarto: true },
);
