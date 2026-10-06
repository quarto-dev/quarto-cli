/*
 * check-render-temp-in-project.test.ts
 *
 * The `quarto check` test renders use the system temp dir, which can sit
 * beneath a project root (Windows %TEMP% is under the home dir). They must
 * render as single files, ignoring that project.
 *
 * Copyright (C) 2026 Posit Software, PBC
 */

import { existsSync } from "../../../src/deno_ral/fs.ts";
import { join, resolve } from "../../../src/deno_ral/path.ts";
import { execProcess } from "../../../src/core/process.ts";
import { unitTest } from "../../test.ts";
import {
  isBinaryMode,
  quartoDevBinCmd,
  quartoSpawnEnvOptions,
} from "../../quarto-cmd.ts";
import {
  canMakeUnreadableDir,
  makeUnreadableDir,
  tempProject,
} from "../../utils.ts";
import { checkRender } from "../../../src/command/check/check-render.ts";
import { renderServices } from "../../../src/command/render/render-services.ts";
import { createTempContext } from "../../../src/core/temp.ts";
import { initYamlIntelligenceResourcesFromFilesystem } from "../../../src/core/schema/utils.ts";
import { notebookContext } from "../../../src/render/notebook/notebook-context.ts";
import { assert } from "testing/asserts";

// Runs quarto as a subprocess: the temp dir comes from the environment, and
// changing it in-process would leak into concurrently running tests.
unitTest(
  "check-install-renders-with-temp-dir-in-project",
  async () => {
    const projectDir = tempProject("quarto-check-render-temp");
    const locked = join(projectDir, "locked");
    Deno.mkdirSync(locked);
    Deno.writeTextFileSync(join(locked, "doc.qmd"), "# Locked\n");
    const tmp = join(projectDir, "tmp");
    Deno.mkdirSync(tmp);
    const restore = makeUnreadableDir(locked);
    try {
      const result = await execProcess({
        // The dev launcher path is relative to tests/, the child runs elsewhere.
        cmd: isBinaryMode() ? quartoDevBinCmd() : resolve(quartoDevBinCmd()),
        args: ["check", "install"],
        cwd: join(projectDir, "sub"),
        stdout: "piped",
        stderr: "piped",
        ...quartoSpawnEnvOptions({ TMP: tmp, TEMP: tmp, TMPDIR: tmp }),
      });
      assert(result.success, `quarto check failed: ${result.stderr}`);
      assert(
        !existsSync(join(projectDir, ".quarto")),
        "quarto check created the project .quarto dir",
      );
    } finally {
      restore();
      Deno.removeSync(projectDir, { recursive: true });
    }
  },
  { ignore: !canMakeUnreadableDir },
);

// The engine checks (`check jupyter`, `check knitr`) render through
// checkRender(), which `check install` never reaches.
unitTest(
  "check-render-with-temp-dir-in-project",
  async () => {
    await initYamlIntelligenceResourcesFromFilesystem();
    const projectDir = tempProject("quarto-check-render-temp");
    const locked = join(projectDir, "locked");
    Deno.mkdirSync(locked);
    Deno.writeTextFileSync(join(locked, "doc.qmd"), "# Locked\n");
    const restore = makeUnreadableDir(locked);
    const services = {
      ...renderServices(notebookContext()),
      temp: createTempContext({ dir: join(projectDir, "tmp") }),
    };
    try {
      const result = await checkRender({
        content: "# Check\n",
        language: "markdown",
        services,
      });
      assert(result.success, `checkRender failed: ${result.error}`);
      assert(
        !existsSync(join(projectDir, ".quarto")),
        "checkRender created the project .quarto dir",
      );
    } finally {
      services.temp.cleanup();
      services.cleanup();
      restore();
      Deno.removeSync(projectDir, { recursive: true });
    }
  },
  { ignore: !canMakeUnreadableDir },
);
