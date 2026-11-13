/*
 * launcher-arguments.test.ts
 *
 * The Windows launcher quarto.cmd must pass its arguments to Deno unchanged,
 * including "!" and "^", which delayed expansion would otherwise consume, and
 * must short-circuit --version, -v and --paths when the caller quotes them.
 * Covered for both the dev layout (package/dist/bin/quarto.cmd) and the
 * bundled layout (bin/quarto.cmd next to quarto.js).
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

const probe = 'import process from "node:process";\n' +
  'console.log("ARGS=" + JSON.stringify(process.argv.slice(2)));\n';

const specialArgs = [
  "C:\\work\\notes!",
  "C:\\x!OS!y",
  "c^d",
  "a & b",
  "100%",
  "%OS%",
  "p (1)",
  "sp ace",
];

interface Launcher {
  cmd: string;
  env: Record<string, string>;
}

async function launch(launcher: Launcher, args: string[], cwd: string) {
  const result = await execProcess({
    cmd: launcher.cmd,
    args,
    cwd,
    stdout: "piped",
    stderr: "piped",
    env: launcher.env,
  });
  const stdout = result.stdout ?? "";
  const details = `(exit ${result.code})\nstdout:\n${stdout}\nstderr:\n${
    result.stderr ?? ""
  }`;
  return { result, stdout, details };
}

async function assertArgumentsReachDeno(
  launcher: Launcher,
  args: string[],
  cwd: string,
) {
  const { result, stdout, details } = await launch(launcher, args, cwd);
  const argsLine = stdout.split(/\r?\n/).find((line) =>
    line.startsWith("ARGS=")
  );
  assertEquals(
    argsLine,
    "ARGS=" + JSON.stringify(args),
    `quarto.cmd changed its arguments ${details}`,
  );
  assert(result.success, `quarto.cmd exited with an error ${details}`);
}

async function assertShortCircuits(launcher: Launcher, cwd: string) {
  for (const flag of ["--version", "-v"]) {
    const { stdout, details } = await launch(launcher, [flag], cwd);
    assertEquals(
      stdout.trim(),
      "9.8.7",
      `quarto.cmd ${flag} did not print the forced version ${details}`,
    );
  }
  const { stdout, details } = await launch(launcher, ["--paths"], cwd);
  assert(
    !stdout.includes("ARGS=") && stdout.trim().split(/\r?\n/).length === 2,
    `quarto.cmd --paths did not print the bin and share paths ${details}`,
  );
}

unitTest(
  "launcher-arguments - bundled quarto.cmd passes arguments unchanged",
  async () => {
    await withTempDir(async (dir) => {
      // Minimal bundled install layout, as in
      // bundled-launcher-path-with-space.test.ts.
      const bin = join(dir, "bin");
      ensureDirSync(bin);
      copySync(
        join(repoRoot, "package", "scripts", "windows", "quarto.cmd"),
        join(bin, "quarto.cmd"),
      );
      writeTextFileSync(join(bin, "quarto.js"), probe);
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
        const launcher = {
          cmd: join(bin, "quarto.cmd"),
          env: { QUARTO_FORCE_VERSION: "9.8.7" },
        };
        await assertArgumentsReachDeno(launcher, ["run", ...specialArgs], dir);
        await assertArgumentsReachDeno(launcher, ["a & b", "x"], dir);
        await assertShortCircuits(launcher, dir);
      } finally {
        // Remove the junction itself (not its target) before the temp dir goes.
        removeSync(tools);
      }
    });
  },
  { ignore: !isWindows },
);

unitTest(
  "launcher-arguments - dev quarto.cmd passes arguments unchanged",
  async () => {
    await withTempDir(async (dir) => {
      const target = join(dir, "probe.ts");
      writeTextFileSync(target, probe);
      const launcher = {
        cmd: join(repoRoot, "package", "dist", "bin", "quarto.cmd"),
        env: {
          QUARTO_TARGET: target,
          QUARTO_NO_TYPECHECK: "true",
          QUARTO_FORCE_VERSION: "9.8.7",
          // See dev-launcher-path-with-space.test.ts: keeps a failed launch
          // from running configure.cmd in the checkout under test.
          NoDefaultCurrentDirectoryInExePath: "1",
        },
      };
      await assertArgumentsReachDeno(launcher, ["run", ...specialArgs], dir);
      await assertArgumentsReachDeno(launcher, ["a & b", "x"], dir);
      await assertShortCircuits(launcher, dir);
    });
  },
  { ignore: !isWindows, requiresDevQuarto: true },
);
