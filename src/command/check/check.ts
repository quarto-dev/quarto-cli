/*
* check.ts
*
* Copyright (C) 2021 by RStudio, PBC
*
*/

import { info } from "log/mod.ts";

import { render, renderServices } from "../render/render-shared.ts";
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
import { readCodePage } from "../../core/windows.ts";
import { RenderServices } from "../render/types.ts";

const kIndent = "      ";

export type Target = "install" | "jupyter" | "knitr" | "all";

export async function check(target: Target): Promise<void> {
  const services = renderServices();
  try {
    info("");
    if (target === "install" || target === "all") {
      await checkInstall(services);
    }
    if (target === "jupyter" || target === "all") {
      await checkJupyterInstallation(services);
    }
    if (target === "knitr" || target === "all") {
      await checkKnitrInstallation(services);
    }
  } finally {
    services.cleanup();
  }
}

async function checkInstall(services: RenderServices) {
  completeMessage("Checking Quarto installation......OK");
  info(`      Version: ${quartoConfig.version()}`);
  info(`      Path: ${quartoConfig.binPath()}`);
  if (Deno.build.os === "windows") {
    try {
      const codePage = readCodePage();
      info(`      CodePage: ${codePage || "unknown"}`);
    } catch {
      info(`      CodePage: Unable to read code page`);
    }
  }
  info("");
  const kMessage = "Checking basic markdown render....";
  await withSpinner({
    message: kMessage,
    doneMessage: kMessage + "OK\n",
  }, async () => {
    const mdPath = services.temp.createFile({ suffix: "check.md" });
    Deno.writeTextFileSync(
      mdPath,
      `
---
title: "Title"
---

## Header
`,
    );
    const result = await render(mdPath, {
      services,
      flags: { quiet: true },
    });
    if (result.error) {
      throw result.error;
    }
  });
}

async function checkJupyterInstallation(services: RenderServices) {
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
        await checkJupyterRender(services);
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

async function checkJupyterRender(services: RenderServices) {
  const qmdPath = services.temp.createFile({ suffix: "check.qmd" });
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
    services,
    flags: { quiet: true, executeDaemon: 0 },
  });
  if (result.error) {
    throw result.error;
  }
}

async function checkKnitrInstallation(services: RenderServices) {
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
        await checkKnitrRender(services);
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

async function checkKnitrRender(services: RenderServices) {
  const rmdPath = services.temp.createFile({ suffix: "check.rmd" });
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
  const result = await render(rmdPath, {
    services,
    flags: { quiet: true },
  });
  if (result.error) {
    throw result.error;
  }
}
