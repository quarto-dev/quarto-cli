/*
 * check-info-project.test.ts
 *
 * `quarto check info` reports the project in play: its root and the
 * _quarto.yml that set it, or single-file mode outside any project. It warns
 * when the project root is the user home directory.
 *
 * Copyright (C) 2026 Posit Software, PBC
 */

import { dirname, join, resolve } from "../../../src/deno_ral/path.ts";
import { execProcess } from "../../../src/core/process.ts";
import { originalRealPathSync } from "../../../src/deno_ral/original-real-path.ts";
import { isWindows } from "../../../src/deno_ral/platform.ts";
import { testQuartoCmd, testQuartoCmdJson, unitTest } from "../../test.ts";
import { noErrors, printsMessage } from "../../verify.ts";
import {
  isBinaryMode,
  quartoDevBinCmd,
  quartoSpawnEnvOptions,
} from "../../quarto-cmd.ts";
import { assert, assertEquals } from "testing/asserts";

// Real path: the project root is resolved from the process cwd, which is a
// real path (macOS temp dirs live under the /var -> /private/var symlink).
function tempDir(prefix: string): string {
  return originalRealPathSync(Deno.makeTempDirSync({ prefix }));
}

// The tree must exist at registration: the harness enters `cwd` before setup.
function tempProject(): string {
  const dir = tempDir("quarto-check-info-project");
  Deno.writeTextFileSync(join(dir, "_quarto.yml"), "project:\n  type: default\n");
  Deno.mkdirSync(join(dir, "sub"));
  return dir;
}

// Teardown runs before the harness restores cwd, and Windows cannot remove
// the process cwd, so leave the dir first.
function removeDir(dir: string) {
  Deno.chdir(dirname(dir));
  Deno.removeSync(dir, { recursive: true });
  return Promise.resolve();
}

(() => {
  const projectDir = tempProject();
  const output = join(projectDir, "check-info.json");
  testQuartoCmdJson(
    "check",
    ["info", "--output", output],
    output,
    "check-info-json-reports-project",
    (json) => {
      assertEquals(json.info.project, {
        dir: projectDir,
        configFile: join(projectDir, "_quarto.yml"),
      });
    },
    {
      cwd: () => join(projectDir, "sub"),
      teardown: () => removeDir(projectDir),
    },
  );
})();

(() => {
  const projectDir = tempProject();
  testQuartoCmd(
    "check",
    ["info"],
    [
      noErrors,
      printsMessage({
        level: "INFO",
        regex: `Project root: ${RegExp.escape(projectDir)}$`,
      }),
      printsMessage({
        level: "INFO",
        regex: `Project config: ${
          RegExp.escape(join(projectDir, "_quarto.yml"))
        }$`,
      }),
    ],
    {
      cwd: () => join(projectDir, "sub"),
      teardown: () => removeDir(projectDir),
    },
  );
})();

(() => {
  const dir = tempDir("quarto-check-info-no-project");
  const output = join(dir, "check-info.json");
  testQuartoCmdJson(
    "check",
    ["info", "--output", output],
    output,
    "check-info-json-reports-no-project",
    (json) => {
      assertEquals(json.info.project, null);
    },
    {
      cwd: () => dir,
      teardown: () => removeDir(dir),
    },
  );
})();

(() => {
  const dir = tempDir("quarto-check-info-no-project");
  testQuartoCmd(
    "check",
    ["info"],
    [
      noErrors,
      printsMessage({
        level: "INFO",
        regex: /Project: none found \(single-file mode\)$/,
      }),
    ],
    {
      cwd: () => dir,
      teardown: () => removeDir(dir),
    },
  );
})();

// Runs quarto as a subprocess: the home dir comes from the environment, and
// changing it in-process would leak into concurrently running tests.
async function assertHomeWarning(project: string, home: string) {
  const output = join(project, "check-info.json");
  const result = await execProcess({
    // The dev launcher path is relative to tests/, the child runs elsewhere.
    cmd: isBinaryMode() ? quartoDevBinCmd() : resolve(quartoDevBinCmd()),
    args: ["check", "info", "--output", output],
    cwd: join(project, "sub"),
    stdout: "piped",
    stderr: "piped",
    ...quartoSpawnEnvOptions({ HOME: home, USERPROFILE: home }),
  });
  assert(result.success, `quarto check failed: ${result.stderr}`);
  const stderr = result.stderr ?? "";
  assert(
    stderr.includes(
      `Project root is your home directory (${project}), set by ${
        join(project, "_quarto.yml")
      }.`,
    ),
    `Missing home directory warning in stderr:\n${stderr}`,
  );
  const json = JSON.parse(Deno.readTextFileSync(output));
  assertEquals(json.info.project.dir, project);
}

unitTest("check-info-warns-when-project-root-is-home", async () => {
  const home = tempProject();
  try {
    await assertHomeWarning(home, home);
  } finally {
    Deno.removeSync(home, { recursive: true });
  }
});

// HOME is a symlink to the project root, which quarto sees as a real path.
// Creating directory symlinks on Windows needs Developer Mode or admin rights.
unitTest(
  "check-info-warns-when-symlinked-home-is-project-root",
  async () => {
    const project = tempProject();
    const alias = `${project}-home`;
    Deno.symlinkSync(project, alias, { type: "dir" });
    try {
      await assertHomeWarning(project, alias);
    } finally {
      Deno.removeSync(alias);
      Deno.removeSync(project, { recursive: true });
    }
  },
  { ignore: isWindows },
);
