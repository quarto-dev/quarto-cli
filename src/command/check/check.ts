/*
* check.ts
*
* Copyright (C) 2021 by RStudio, PBC
*
*/

import { join } from "path/mod.ts";
import { info } from "log/mod.ts";

import * as colors from "fmt/colors.ts";

import { createSessionTempDir } from "../../core/temp.ts";
import { render } from "../render/render.ts";
import {
  JupyterCapabilities,
  jupyterCapabilities,
} from "../../core/jupyter/capabilities.ts";
import { completeMessage, withSpinner } from "../../core/console.ts";
import { KnitrCapabilities, knitrCapabilities } from "../../core/knitr.ts";
import { quartoConfig } from "../../core/quarto.ts";
import { pythonExec } from "../../core/jupyter/exec.ts";
import {
  JupyterKernelspec,
  jupyterKernelspecs,
} from "../../core/jupyter/kernels.ts";

export type Target = "install" | "jupyter" | "knitr" | "all";

export async function check(target: Target): Promise<void> {
  const tmpDir = createSessionTempDir();
  info("");
  if (target === "install" || target === "all") {
    await checkInstall(tmpDir);
  }
  if (target === "jupyter" || target === "all") {
    await checkJupyterInstallation(tmpDir);
  }
  if (target === "knitr" || target === "all") {
    await checkKnitrInstallation(tmpDir);
  }
}

async function checkInstall(tmpDir: string) {
  completeMessage("Checking Quarto installation......OK");
  info(`      Version: ${quartoConfig.version()}`);
  info(`      Path: ${quartoConfig.binPath()}`);
  info("");
  const kMessage = "Checking basic markdown render....";
  await withSpinner({
    message: kMessage,
    doneMessage: kMessage + "OK\n",
  }, async () => {
    const mdPath = join(tmpDir, "check.md");
    Deno.writeTextFileSync(
      mdPath,
      `
---
title: "Title"
---

## Header
`,
    );
    const result = await render(mdPath, { flags: { quiet: true } });
    if (result.error) {
      throw result.error;
    }
  });
}

async function checkJupyterInstallation(tmpDir: string) {
  const kMessage = "Checking Python 3 installation....";
  let caps: JupyterCapabilities | undefined;
  await withSpinner({
    message: kMessage,
    doneMessage: false,
  }, async () => {
    caps = await jupyterCapabilities();
  });
  if (caps && caps.versionMajor >= 3) {
    completeMessage(kMessage + "OK");
    info(
      `      Version: ${caps.versionMajor}.${caps.versionMinor}.${caps.versionPatch}${
        caps.conda ? " (Conda)" : ""
      }`,
    );
    info(`      Path: ${caps.executable}`);
    info(`      Jupyter: ${caps.jupyter_core || "(None)"}`);
    if (caps.jupyter_core) {
      const kernels = Array.from((await jupyterKernelspecs()).values())
        .map((kernel: JupyterKernelspec) => kernel.name).join(", ");
      info(`      Kernels: ${kernels}`);
    }
    info("");
    if (caps.jupyter_core) {
      const kJupyterMessage = "Checking Jupyter engine render....";
      await withSpinner({
        message: kJupyterMessage,
        doneMessage: kJupyterMessage + "OK\n",
      }, async () => {
        await checkJupyterRender(tmpDir);
      });
    } else {
      info(
        "      Jupyter not available in this Python installation.\n" +
          "      Install with " + colors.bold(`${
            caps.conda
              ? "conda"
              : (await pythonExec()).join(" ") + " -m pip"
          } install jupyter`) + "\n",
      );
    }
  } else {
    completeMessage(kMessage + "(None)\n");
    info(
      "    Install Python 3 from " +
        colors.bold("https://www.python.org/downloads/\n"),
    );
  }
}

async function checkJupyterRender(tmpDir: string) {
  const qmdPath = join(tmpDir, "check.qmd");
  Deno.writeTextFileSync(
    qmdPath,
    `
---
title: "Title"
---

## Header

\`\`\`{python}
1 + 1
\`\`\`
`,
  );
  const result = await render(qmdPath, { flags: { quiet: true } });
  if (result.error) {
    throw result.error;
  }
}

async function checkKnitrInstallation(tmpDir: string) {
  const kMessage = "Checking R installation...........";
  let caps: KnitrCapabilities | undefined;
  await withSpinner({
    message: kMessage,
    doneMessage: false,
  }, async () => {
    caps = await knitrCapabilities();
  });
  if (caps) {
    completeMessage(kMessage + "OK");
    info(
      `      Version: ${caps.versionMajor}.${caps.versionMinor}.${caps.versionPatch}`,
    );
    info(`      Path: ${caps.home}`);
    info(`      LibPaths:`);
    for (const path of caps.libPaths) {
      info(`        - ${path}`);
    }
    info(`      rmarkdown: ${caps.rmarkdown || "(None)"}`);
    info("");
    if (caps.rmarkdown) {
      const kKnitrMessage = "Checking Knitr engine render......";
      await withSpinner({
        message: kKnitrMessage,
        doneMessage: kKnitrMessage + "OK\n",
      }, async () => {
        await checkKnitrRender(tmpDir);
      });
    } else {
      info(
        "      The rmarkdown package is not available in this R installation.\n" +
          "      Install with " +
          colors.bold('install.packages("rmarkdown")') + "\n",
      );
    }
  } else {
    completeMessage(kMessage + "(None)\n");
    info(
      "    Install R from " +
        colors.bold("https://cloud.r-project.org/\n"),
    );
  }
}

async function checkKnitrRender(tmpDir: string) {
  const rmdPath = join(tmpDir, "check.rmd");
  Deno.writeTextFileSync(
    rmdPath,
    `
---
title: "Title"
---

## Header

\`\`\`{r}
1 + 1
\`\`\`
`,
  );
  const result = await render(rmdPath, { flags: { quiet: true } });
  if (result.error) {
    throw result.error;
  }
}
