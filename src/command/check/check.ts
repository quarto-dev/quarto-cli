/*
 * check.ts
 *
 * Copyright (C) 2021-2022 Posit Software, PBC
 */

import { info } from "../../deno_ral/log.ts";

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
  checkRBinary,
  KnitrCapabilities,
  knitrCapabilities,
  knitrCapabilitiesMessage,
  knitrInstallationMessage,
  rInstallationMessage,
} from "../../core/knitr.ts";
import { quartoConfig } from "../../core/quarto.ts";
import {
  cacheCodePage,
  clearCodePageCache,
  readCodePage,
} from "../../core/windows.ts";
import { RenderServices } from "../render/types.ts";
import { jupyterKernelspecForLanguage } from "../../core/jupyter/kernels.ts";
import { execProcess } from "../../core/process.ts";
import { pandocBinaryPath } from "../../core/resources.ts";
import { lines } from "../../core/text.ts";
import { satisfies } from "semver/mod.ts";
import { dartCommand } from "../../core/dart-sass.ts";
import { allTools } from "../../tools/tools.ts";
import { texLiveContext, tlVersion } from "../render/latexmk/texlive.ts";
import { which } from "../../core/path.ts";
import { dirname } from "../../deno_ral/path.ts";
import { notebookContext } from "../../render/notebook/notebook-context.ts";
import { typstBinaryPath } from "../../core/typst.ts";
import { quartoCacheDir } from "../../core/appdirs.ts";
import { isWindows } from "../../deno_ral/platform.ts";
import { makeStringEnumTypeEnforcer } from "../../typing/dynamic.ts";

export const kTargets = [
  "install",
  "info",
  "jupyter",
  "knitr",
  "versions",
  "all",
] as const;
export type Target = typeof kTargets[number];
export const enforceTargetType = makeStringEnumTypeEnforcer(...kTargets);

const kIndent = "      ";

export async function check(target: Target): Promise<void> {
  const services = renderServices(notebookContext());
  try {
    info(`Quarto ${quartoConfig.version()}`);
    if (target === "info" || target === "all") {
      await checkInfo(services);
    }
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

// Currently this doesn't check anything
// but it's a placeholder for future checks
// and the message is useful for troubleshooting
async function checkInfo(_services: RenderServices) {
  const cacheDir = quartoCacheDir();
  completeMessage("Checking environment information...");
  info(kIndent + "Quarto cache location: " + cacheDir);
}

async function checkVersions(_services: RenderServices) {
  const checkVersion = async (
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

  // manually check Deno version without shelling out
  // because we're actually running in Deno right now
  if (!satisfies(Deno.version.deno, ">=1.33.1")) {
    info(
      `      NOTE: Deno version ${Deno.version.deno} is too old. Please upgrade to 1.33.1 or later.`,
    );
  } else {
    info(`      Deno version ${Deno.version.deno}: OK`);
  }

  let typstVersion = lines(
    (await execProcess({
      cmd: [typstBinaryPath(), "--version"],
      stdout: "piped",
    })).stdout!,
  )[0].split(" ")[1];
  checkVersion(typstVersion, ">=0.10.0", "Typst");

  completeMessage("Checking versions of quarto dependencies......OK");
}

async function checkInstall(services: RenderServices) {
  completeMessage("Checking Quarto installation......OK");
  info(`${kIndent}Version: ${quartoConfig.version()}`);
  if (quartoConfig.version() === "99.9.9") {
    // if they're running a dev version, we assume git is installed
    // and QUARTO_ROOT is set to the root of the quarto-cli repo
    // print the output of git rev-parse HEAD
    const quartoRoot = Deno.env.get("QUARTO_ROOT");
    if (quartoRoot) {
      const gitHead = await execProcess({
        cmd: ["git", "-C", quartoRoot, "rev-parse", "HEAD"],
        stdout: "piped",
        stderr: "piped", // to not show error if not in a git repo
      });
      if (gitHead.success && gitHead.stdout) {
        info(`${kIndent}commit: ${gitHead.stdout.trim()}`);
      }
    }
  }
  info(`${kIndent}Path: ${quartoConfig.binPath()}`);
  if (isWindows) {
    try {
      const codePage = readCodePage();
      clearCodePageCache();
      await cacheCodePage();
      const codePage2 = readCodePage();

      info(`${kIndent}CodePage: ${codePage2 || "unknown"}`);
      if (codePage && codePage !== codePage2) {
        info(
          `${kIndent}NOTE: Code page updated from ${codePage} to ${codePage2}. Previous rendering may have been affected.`,
        );
      }
      // if non-standard code page, check for non-ascii characters in path
      // deno-lint-ignore no-control-regex
      const nonAscii = /[^\x00-\x7F]+/;
      if (nonAscii.test(quartoConfig.binPath())) {
        info(
          `${kIndent}ERROR: Non-ASCII characters in Quarto path causes rendering problems.`,
        );
      }
    } catch {
      info(`${kIndent}CodePage: Unable to read code page`);
    }
  }

  info("");
  const toolsMessage = "Checking tools....................";
  const toolsOutput: string[] = [];
  await withSpinner({
    message: toolsMessage,
    doneMessage: toolsMessage + "OK",
  }, async () => {
    const tools = await allTools();

    for (const tool of tools.installed) {
      const version = await tool.installedVersion() || "(external install)";
      toolsOutput.push(`${kIndent}${tool.name}: ${version}`);
    }
    for (const tool of tools.notInstalled) {
      toolsOutput.push(`${kIndent}${tool.name}: (not installed)`);
    }
  });
  toolsOutput.forEach((out) => info(out));
  info("");

  const latexMessage = "Checking LaTeX....................";
  const latexOutput: string[] = [];
  await withSpinner({
    message: latexMessage,
    doneMessage: latexMessage + "OK",
  }, async () => {
    const tlContext = await texLiveContext(true);
    if (tlContext.hasTexLive) {
      const version = await tlVersion(tlContext);

      if (tlContext.usingGlobal) {
        const tlMgrPath = await which("tlmgr");

        latexOutput.push(`${kIndent}Using: Installation From Path`);
        if (tlMgrPath) {
          latexOutput.push(`${kIndent}Path: ${dirname(tlMgrPath)}`);
        }
      } else {
        latexOutput.push(`${kIndent}Using: TinyTex`);
        if (tlContext.binDir) {
          latexOutput.push(`${kIndent}Path: ${tlContext.binDir}`);
        }
      }
      latexOutput.push(`${kIndent}Version: ${version}`);
    } else {
      latexOutput.push(`${kIndent}Tex:  (not detected)`);
    }
  });
  latexOutput.forEach((out) => info(out));
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
  let rBin: string | undefined;
  await withSpinner({
    message: kMessage,
    doneMessage: false,
  }, async () => {
    rBin = await checkRBinary();
    caps = await knitrCapabilities(rBin);
  });
  if (rBin && caps) {
    completeMessage(kMessage + "OK");
    info(knitrCapabilitiesMessage(caps, kIndent));
    info("");
    if (caps.packages.rmarkdownVersOk && caps.packages.knitrVersOk) {
      const kKnitrMessage = "Checking Knitr engine render......";
      await withSpinner({
        message: kKnitrMessage,
        doneMessage: kKnitrMessage + "OK\n",
      }, async () => {
        await checkKnitrRender(services);
      });
    } else {
      // show install message if not available
      // or update message if not up to date
      if (!!!caps.packages.knitr || !caps.packages.knitrVersOk) {
        info(
          knitrInstallationMessage(
            kIndent,
            "knitr",
            !!caps.packages.knitr && !caps.packages.knitrVersOk,
          ),
        );
      }
      if (!!!caps.packages.rmarkdown || !caps.packages.rmarkdownVersOk) {
        info(
          knitrInstallationMessage(
            kIndent,
            "rmarkdown",
            !!caps.packages.rmarkdown && !caps.packages.rmarkdownVersOk,
          ),
        );
      }
      info("");
    }
  } else if (rBin === undefined) {
    completeMessage(kMessage + "(None)\n");
    info(rInstallationMessage(kIndent));
    info("");
  } else if (caps === undefined) {
    completeMessage(kMessage + "(None)\n");
    info(`R succesfully found at ${rBin}.`);
    info(
      "However, a problem was encountered when checking configurations of packages.",
    );
    info("Please check your installation of R.");
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
