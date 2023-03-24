/*
 * check.ts
 *
 * Copyright (C) 2021-2022 Posit Software, PBC
 */

import { info } from "log/mod.ts";

import { render } from "../render/render-shared.ts";
import { renderServices } from "../render/render-services.ts";

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
import { jupyterKernelspecForLanguage } from "../../core/jupyter/kernels.ts";
import { execProcess } from "../../core/process.ts";
import { pandocBinaryPath } from "../../core/resources.ts";
import { lines } from "../../core/text.ts";
import { satisfies } from "semver/mod.ts";
import { dartCommand } from "../../core/dart-sass.ts";

const kIndent = "      ";

export type Target = "install" | "jupyter" | "knitr" | "versions" | "all";

export async function check(target: Target): Promise<void> {
  const services = renderServices();
  try {
    info("");
    if (target === "versions" || target === "all") {
      await checkVersions(services);
    }
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

async function checkVersions(_services: RenderServices) {
  const checkVersion = (
    version: string | undefined,
    constraint: string,
    name: string,
  ) => {
    if (typeof version !== "string") {
      throw new Error(`Unable to determine ${name} version`);
    }
    if (!satisfies(version, constraint)) {
      info(
        `      NOTE: ${name} version ${version} is too old. Please upgrade to ${
          constraint.slice(2)
        } or later.`,
      );
    } else {
      info(`      ${name} version ${version}: OK`);
    }
  };

  completeMessage("Checking versions of quarto binary dependencies...");

  let pandocVersion = lines(
    (await execProcess({
      cmd: [pandocBinaryPath(), "--version"],
      stdout: "piped",
    })).stdout!,
  )[0]?.split(" ")[1];
  // We hack around pandocVersion to build a sem-verish string
  // that satisfies the semver package
  // if pandoc reports more than three version numbers, pick the first three
  // if pandoc reports fewer than three version numbers, pad with zeros
  if (pandocVersion) {
    const versionParts = pandocVersion.split(".");
    if (versionParts.length > 3) {
      pandocVersion = versionParts.slice(0, 3).join(".");
    } else if (versionParts.length < 3) {
      pandocVersion = versionParts.concat(
        Array(3 - versionParts.length).fill("0"),
      ).join(".");
    }
  }
  checkVersion(pandocVersion, ">=2.19.2", "Pandoc");

  const sassVersion = (await dartCommand(["--version"]))?.trim();
  checkVersion(sassVersion, ">=1.32.8", "Dart Sass");

  completeMessage("Checking versions of quarto dependencies......OK");
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
      if (await jupyterKernelspecForLanguage("python")) {
        const kJupyterMessage = "Checking Jupyter engine render....";
        await withSpinner({
          message: kJupyterMessage,
          doneMessage: kJupyterMessage + "OK\n",
        }, async () => {
          await checkJupyterRender(services);
        });
      } else {
        info(
          kIndent + "NOTE: No Jupyter kernel for Python found",
        );
        info("");
      }
    } else {
      info(jupyterInstallationMessage(caps, kIndent));
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
    if (caps.packages.rmarkdown && caps.packages.knitrVersOk) {
      const kKnitrMessage = "Checking Knitr engine render......";
      await withSpinner({
        message: kKnitrMessage,
        doneMessage: kKnitrMessage + "OK\n",
      }, async () => {
        await checkKnitrRender(services);
      });
    } else {
      info(
        knitrInstallationMessage(
          kIndent,
          caps.packages.knitr && !caps.packages.knitrVersOk
            ? "knitr"
            : "rmarkdown",
          !!caps.packages.knitr && !caps.packages.knitrVersOk,
        ),
      );
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
