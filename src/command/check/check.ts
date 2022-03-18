/*
* check.ts
*
* Copyright (C) 2021 by RStudio, PBC
*
*/

import { info } from "log/mod.ts";

import { createTempContext, TempContext } from "../../core/temp.ts";
import { render } from "../render/render-shared.ts";
import { JupyterCapabilities } from "../../core/jupyter/types.ts";
import { jupyterCapabilities } from "../../core/jupyter/capabilities.ts";
import {
  jupyterCapabilitiesMessage,
  jupyterInstallationMessage,
  jupyterUnactivatedEnvMessage,
  pythonInstallationMessage,
} from "../../core/jupyter/jupyter-shared.ts";
import { completeMessage, withSpinner } from "../../core/console.ts";
import {
  KnitrCapabilities,
  knitrCapabilities,
  knitrCapabilitiesMessage,
  knitrInstallationMessage,
  rInstallationMessage,
} from "../../core/knitr.ts";
import { quartoConfig } from "../../core/quarto.ts";
import { windowsCodePage } from "../../core/windows.ts";

const kIndent = "      ";

export type Target = "install" | "jupyter" | "knitr" | "all";

export async function check(target: Target): Promise<void> {
  const temp = createTempContext();
  try {
    info("");
    if (target === "install" || target === "all") {
      await checkInstall(temp);
    }
    if (target === "jupyter" || target === "all") {
      await checkJupyterInstallation(temp);
    }
    if (target === "knitr" || target === "all") {
      await checkKnitrInstallation(temp);
    }
  } finally {
    temp.cleanup();
  }
}

async function checkInstall(temp: TempContext) {
  completeMessage("Checking Quarto installation......OK");
  info(`      Version: ${quartoConfig.version()}`);
  info(`      Path: ${quartoConfig.binPath()}`);
  if (Deno.build.os === "windows") {
    const codePage = windowsCodePage();
    info(`      CodePage: ${codePage || "unknown"}`);
  }
  info("");
  const kMessage = "Checking basic markdown render....";
  await withSpinner({
    message: kMessage,
    doneMessage: kMessage + "OK\n",
  }, async () => {
    const mdPath = temp.createFile({ suffix: "check.md" });
    Deno.writeTextFileSync(
      mdPath,
      `
---
title: "Title"
---

## Header
`,
    );
    const result = await render(mdPath, { temp, flags: { quiet: true } });
    if (result.error) {
      throw result.error;
    }
  });
}

async function checkJupyterInstallation(temp: TempContext) {
  const kMessage = "Checking Python 3 installation....";
  let caps: JupyterCapabilities | undefined;
  await withSpinner({
    message: kMessage,
    doneMessage: false,
  }, async () => {
    caps = await jupyterCapabilities();
  });
  if (caps) {
    completeMessage(kMessage + "OK");
    info(await jupyterCapabilitiesMessage(caps, kIndent));
    info("");
    if (caps.jupyter_core) {
      const kJupyterMessage = "Checking Jupyter engine render....";
      await withSpinner({
        message: kJupyterMessage,
        doneMessage: kJupyterMessage + "OK\n",
      }, async () => {
        await checkJupyterRender(temp);
      });
    } else {
      info(await jupyterInstallationMessage(caps, kIndent));
      info("");
      const envMessage = jupyterUnactivatedEnvMessage(caps, kIndent);
      if (envMessage) {
        info(envMessage);
        info("");
      }
    }
  } else {
    completeMessage(kMessage + "(None)\n");
    info(pythonInstallationMessage(kIndent));
    info("");
  }
}

async function checkJupyterRender(temp: TempContext) {
  const qmdPath = temp.createFile({ suffix: "check.qmd" });
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
  const result = await render(qmdPath, {
    temp,
    flags: { quiet: true, executeDaemon: 0 },
  });
  if (result.error) {
    throw result.error;
  }
}

async function checkKnitrInstallation(temp: TempContext) {
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
    info(knitrCapabilitiesMessage(caps, kIndent));
    info("");
    if (caps.rmarkdown) {
      const kKnitrMessage = "Checking Knitr engine render......";
      await withSpinner({
        message: kKnitrMessage,
        doneMessage: kKnitrMessage + "OK\n",
      }, async () => {
        await checkKnitrRender(temp);
      });
    } else {
      info(knitrInstallationMessage(kIndent));
      info("");
    }
  } else {
    completeMessage(kMessage + "(None)\n");
    info(rInstallationMessage(kIndent));
    info("");
  }
}

async function checkKnitrRender(temp: TempContext) {
  const rmdPath = temp.createFile({ suffix: "check.rmd" });
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
  const result = await render(rmdPath, { temp, flags: { quiet: true } });
  if (result.error) {
    throw result.error;
  }
}
