/*
 * dev-launcher-deno-version.test.ts
 *
 * The dev launcher package/scripts/windows/quarto.cmd must leave
 * config/deno-version to configure.cmd, so a failed reconfigure keeps the
 * stale-Deno check armed.
 *
 * Copyright (C) 2026 Posit Software, PBC
 */

import { unitTest } from "../test.ts";
import { assert, assertEquals } from "../asserts.ts";
import { isWindows } from "../../src/deno_ral/platform.ts";
import { dirname, fromFileUrl, join } from "../../src/deno_ral/path.ts";
import {
  copySync,
  ensureDirSync,
  existsSync,
  readTextFileSync,
  writeTextFileSync,
} from "../../src/deno_ral/fs.ts";
import { execProcess } from "../../src/core/process.ts";
import { getenv } from "../../src/core/env.ts";
import { withTempDir } from "../utils.ts";

const repoRoot = join(dirname(fromFileUrl(import.meta.url)), "..", "..");
const launcherSource = join(
  repoRoot,
  "package",
  "scripts",
  "windows",
  "quarto.cmd",
);

// Lays out the minimum the dev launcher needs in `root`: a src/quarto.ts so it
// takes the dev branch, a win_configuration.bat pinning DENO, a configure.cmd
// stub that records its run and fails, and the launcher in package/dist/bin.
// Running the launcher there can never reconfigure the real checkout.
function createFakeCheckout(root: string, pinnedDeno: string) {
  ensureDirSync(join(root, "src"));
  writeTextFileSync(join(root, "src", "quarto.ts"), "");
  writeTextFileSync(
    join(root, "win_configuration.bat"),
    `SET "DENO=${pinnedDeno}"\r\nset "QUARTO_SRC_PATH=%~dp0src"\r\nset "QUARTO_BIN_PATH=%~dp0package\\dist\\bin"\r\n`,
  );
  writeTextFileSync(
    join(root, "configure.cmd"),
    `@ECHO OFF\r\nECHO ran>"%~dp0configure-ran"\r\nEXIT /B 1\r\n`,
  );
  const bin = join(root, "package", "dist", "bin");
  ensureDirSync(bin);
  ensureDirSync(join(root, "package", "dist", "config"));
  copySync(launcherSource, join(bin, "quarto.cmd"));
  return {
    launcher: join(bin, "quarto.cmd"),
    denoVersionFile: join(root, "package", "dist", "config", "deno-version"),
    configureRan: join(root, "configure-ran"),
  };
}

function runLauncher(launcher: string, root: string) {
  return execProcess({
    cmd: launcher,
    args: ["--help"],
    cwd: root,
    stdout: "piped",
    stderr: "piped",
    env: {
      QUARTO_NO_TYPECHECK: "true",
      // Resolve `call configure.cmd` to the stub even when the parent
      // environment sets NoDefaultCurrentDirectoryInExePath.
      PATH: `${root};${getenv("PATH", "")}`,
    },
  });
}

unitTest(
  "dev-launcher - a failed reconfigure keeps the previous deno-version",
  async () => {
    await withTempDir(async (root) => {
      const fake = createFakeCheckout(root, "v99.0.0");
      writeTextFileSync(fake.denoVersionFile, "v1.0.0\r\n");

      const result = await runLauncher(fake.launcher, root);

      assert(
        existsSync(fake.configureRan),
        `the stale-Deno branch did not call configure.cmd\nstdout:\n${result.stdout}\nstderr:\n${result.stderr}`,
      );
      assertEquals(
        readTextFileSync(fake.denoVersionFile).trim(),
        "v1.0.0",
        "deno-version must keep naming the installed Deno after a failed reconfigure",
      );
    });
  },
  { ignore: !isWindows },
);

unitTest(
  "dev-launcher - a missing deno-version is not created from the pinned version",
  async () => {
    await withTempDir(async (root) => {
      const fake = createFakeCheckout(root, "v99.0.0");

      await runLauncher(fake.launcher, root);

      assert(
        !existsSync(fake.denoVersionFile),
        "the launcher recorded a Deno version it never verified",
      );
    });
  },
  { ignore: !isWindows },
);
