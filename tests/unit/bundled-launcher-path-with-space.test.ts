/*
 * bundled-launcher-path-with-space.test.ts
 *
 * The bundled launcher bin/quarto.cmd, which the Windows installers ship next
 * to quarto.exe, must work when the install path contains a space.
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
  removeSync,
  writeTextFileSync,
} from "../../src/deno_ral/fs.ts";
import { execProcess } from "../../src/core/process.ts";
import { withTempDir } from "../utils.ts";

const repoRoot = join(dirname(fromFileUrl(import.meta.url)), "..", "..");

unitTest(
  "bundled-launcher - quarto.cmd runs from an install path containing a space",
  async () => {
    await withTempDir(async (dir) => {
      // Minimal bundled install layout: bin/quarto.cmd and bin/quarto.js,
      // with no src/quarto.ts above it, so the launcher takes its bundled
      // branch. bin/tools is a junction to the dev tools for deno.exe.
      const bin = join(dir, "q space", "bin");
      ensureDirSync(bin);
      copySync(
        join(repoRoot, "package", "scripts", "windows", "quarto.cmd"),
        join(bin, "quarto.cmd"),
      );
      writeTextFileSync(
        join(bin, "quarto.js"),
        'import process from "node:process";\n' +
          'console.log("ARGS=" + JSON.stringify(process.argv.slice(2)));\n',
      );
      const tools = join(bin, "tools");
      const mklink = await execProcess({
        cmd: "cmd",
        args: [
          "/c",
          "mklink",
          "/J",
          tools,
          join(repoRoot, "package", "dist", "bin", "tools"),
        ],
        stdout: "piped",
        stderr: "piped",
      });
      assert(mklink.success, `creating the junction failed: ${mklink.stderr}`);
      try {
        const result = await execProcess({
          cmd: join(bin, "quarto.cmd"),
          args: ["check", "some arg"],
          cwd: dir,
          stdout: "piped",
          stderr: "piped",
        });
        const stdout = result.stdout ?? "";
        const stderr = result.stderr ?? "";
        const argsLine = stdout.split(/\r?\n/).find((line) =>
          line.startsWith("ARGS=")
        );
        assertEquals(
          argsLine,
          'ARGS=["check","some arg"]',
          `quarto.cmd did not run quarto.js with its arguments (exit ${result.code})\nstdout:\n${stdout}\nstderr:\n${stderr}`,
        );
      } finally {
        // Remove the junction itself (not its target) before the temp dir goes.
        removeSync(tools);
      }
    });
  },
  { ignore: !isWindows },
);
