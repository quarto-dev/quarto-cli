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
  jupyterCapabilitiesJson,
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
import { RenderServiceWithLifetime } from "../render/types.ts";
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
import { findChrome } from "../../core/puppeteer.ts";

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

type CheckJsonResult = Record<string, unknown>;

type CheckConfiguration = {
  strict: boolean;
  target: Target;
  output: string | undefined;
  services: RenderServiceWithLifetime;
  jsonResult: CheckJsonResult | undefined;
};

function checkCompleteMessage(conf: CheckConfiguration, message: string) {
  if (!conf.jsonResult) {
    completeMessage(message);
  }
}

function checkInfoMsg(conf: CheckConfiguration, message: string) {
  if (!conf.jsonResult) {
    info(message);
  }
}

export async function check(
  target: Target,
  strict?: boolean,
  output?: string,
): Promise<void> {
  const services = renderServices(notebookContext());
  const conf: CheckConfiguration = {
    strict: !!strict,
    target: target,
    output,
    services,
    jsonResult: undefined,
  };
  if (conf.output) {
    conf.jsonResult = {
      strict,
    };
  }
  try {
    if (conf.jsonResult) {
      conf.jsonResult.version = quartoConfig.version();
    }
    checkInfoMsg(conf, `Quarto ${quartoConfig.version()}`);

    for (
      const [name, checker] of [
        ["info", checkInfo],
        ["versions", checkVersions],
        ["install", checkInstall],
        ["jupyter", checkJupyterInstallation],
        ["knitr", checkKnitrInstallation],
      ] as const
    ) {
      if (target === name || target === "all") {
        await checker(conf);
      }
    }

    if (conf.jsonResult && conf.output) {
      await Deno.writeTextFile(
        conf.output,
        JSON.stringify(conf.jsonResult, null, 2),
      );
    }
  } finally {
    services.cleanup();
  }
}

// Currently this doesn't check anything
// but it's a placeholder for future checks
// and the message is useful for troubleshooting
async function checkInfo(conf: CheckConfiguration) {
  const cacheDir = quartoCacheDir();
  if (conf.jsonResult) {
    conf.jsonResult!.info = { cacheDir };
  }
  checkCompleteMessage(conf, "Checking environment information...");
  checkInfoMsg(conf, kIndent + "Quarto cache location: " + cacheDir);
}

async function checkVersions(conf: CheckConfiguration) {
  const {
    strict,
  } = conf;
  const checkVersion = (
    version: string | undefined,
    constraint: string,
    name: string,
  ) => {
    if (typeof version !== "string") {
      throw new Error(`Unable to determine ${name} version`);
    }
    const good = satisfies(version, constraint);
    if (conf.jsonResult) {
      if (conf.jsonResult.dependencies === undefined) {
        conf.jsonResult.dependencies = {};
      }
      (conf.jsonResult.dependencies as Record<string, unknown>)[name] = {
        version,
        constraint,
        satisfies: good,
      };
    }
    if (!good) {
      checkInfoMsg(
        conf,
        `      NOTE: ${name} version ${version} is too old. Please upgrade to ${
          constraint.slice(2)
        } or later.`,
      );
    } else {
      checkInfoMsg(conf, `      ${name} version ${version}: OK`);
    }
  };

  const strictCheckVersion = (
    version: string,
    constraint: string,
    name: string,
  ) => {
    const good = version === constraint;
    if (conf.jsonResult) {
      if (conf.jsonResult.dependencies === undefined) {
        conf.jsonResult.dependencies = {};
      }
      (conf.jsonResult.dependencies as Record<string, unknown>)[name] = {
        version,
        constraint,
        satisfies: good,
      };
    }
    if (!good) {
      checkInfoMsg(
        conf,
        `      NOTE: ${name} version ${version} does not strictly match ${constraint} and strict checking is enabled. Please use ${constraint}.`,
      );
    } else {
      checkInfoMsg(conf, `      ${name} version ${version}: OK`);
    }
  };

  checkCompleteMessage(
    conf,
    "Checking versions of quarto binary dependencies...",
  );

  let pandocVersion = lines(
    (await execProcess({
      cmd: pandocBinaryPath(),
      args: ["--version"],
      stdout: "piped",
    })).stdout!,
  )[0]?.split(" ")[1];
  const sassVersion = (await dartCommand(["--version"]))?.trim();
  const denoVersion = Deno.version.deno;
  const typstVersion = lines(
    (await execProcess({
      cmd: typstBinaryPath(),
      args: ["--version"],
      stdout: "piped",
    })).stdout!,
  )[0].split(" ")[1];

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

  // FIXME: all of these strict checks should be done by
  // loading the configuration file directly, but that
  // file is in an awkward format and it is not packaged
  // with our installers
  const checkData: [string | undefined, string, string][] = strict
    ? [
      [pandocVersion, "3.6.3", "Pandoc"],
      [sassVersion, "1.87.0", "Dart Sass"],
      [denoVersion, "2.3.1", "Deno"],
      [typstVersion, "0.13.0", "Typst"],
    ]
    : [
      [pandocVersion, ">=3.6.3", "Pandoc"],
      [sassVersion, ">=1.87.0", "Dart Sass"],
      [denoVersion, ">=2.3.1", "Deno"],
      [typstVersion, ">=0.13.0", "Typst"],
    ];
  const fun = strict ? strictCheckVersion : checkVersion;
  for (const [version, constraint, name] of checkData) {
    if (version === undefined) {
      if (conf.jsonResult) {
        if (conf.jsonResult.dependencies === undefined) {
          conf.jsonResult.dependencies = {};
        }
        (conf.jsonResult.dependencies as Record<string, unknown>)[name] = {
          version,
          constraint,
          found: false,
        };
      }
      checkInfoMsg(conf, `      ${name} version: (not detected)`);
    } else {
      fun(version, constraint, name);
    }
  }

  checkCompleteMessage(
    conf,
    "Checking versions of quarto dependencies......OK",
  );
}

async function checkInstall(conf: CheckConfiguration) {
  const {
    services,
  } = conf;
  checkCompleteMessage(conf, "Checking Quarto installation......OK");
  checkInfoMsg(conf, `${kIndent}Version: ${quartoConfig.version()}`);
  if (quartoConfig.version() === "99.9.9") {
    // if they're running a dev version, we assume git is installed
    // and QUARTO_ROOT is set to the root of the quarto-cli repo
    // print the output of git rev-parse HEAD
    const quartoRoot = Deno.env.get("QUARTO_ROOT");
    if (quartoRoot) {
      const gitHead = await execProcess({
        cmd: "git",
        args: ["-C", quartoRoot, "rev-parse", "HEAD"],
        stdout: "piped",
        stderr: "piped", // to not show error if not in a git repo
      });
      if (gitHead.success && gitHead.stdout) {
        checkInfoMsg(conf, `${kIndent}commit: ${gitHead.stdout.trim()}`);
        if (conf.jsonResult) {
          conf.jsonResult["quarto-dev-version"] = gitHead.stdout.trim();
        }
      }
    }
  }
  checkInfoMsg(conf, `${kIndent}Path: ${quartoConfig.binPath()}`);
  if (conf.jsonResult) {
    conf.jsonResult["quarto-path"] = quartoConfig.binPath();
  }

  if (isWindows) {
    const json: Record<string, unknown> = {};
    if (conf.jsonResult) {
      conf.jsonResult.windows = json;
    }
    try {
      const codePage = readCodePage();
      clearCodePageCache();
      await cacheCodePage();
      const codePage2 = readCodePage();

      checkInfoMsg(conf, `${kIndent}CodePage: ${codePage2 || "unknown"}`);
      json["code-page"] = codePage2 || "unknown";
      if (codePage && codePage !== codePage2) {
        checkInfoMsg(
          conf,
          `${kIndent}NOTE: Code page updated from ${codePage} to ${codePage2}. Previous rendering may have been affected.`,
        );
        json["code-page-updated-from"] = codePage;
      }
      // if non-standard code page, check for non-ascii characters in path
      // deno-lint-ignore no-control-regex
      const nonAscii = /[^\x00-\x7F]+/;
      if (nonAscii.test(quartoConfig.binPath())) {
        checkInfoMsg(
          conf,
          `${kIndent}ERROR: Non-ASCII characters in Quarto path causes rendering problems.`,
        );
        json["non-ascii-in-path"] = true;
      }
    } catch {
      checkInfoMsg(conf, `${kIndent}CodePage: Unable to read code page`);
      json["error"] = "Unable to read code page";
    }
  }

  checkInfoMsg(conf, "");
  const toolsMessage = "Checking tools....................";
  const toolsOutput: string[] = [];
  let tools: Awaited<ReturnType<typeof allTools>>;
  const toolsJson: Record<string, unknown> = {};
  if (conf.jsonResult) {
    conf.jsonResult.tools = toolsJson;
  }
  const toolsCb = async () => {
    tools = await allTools();

    for (const tool of tools.installed) {
      const version = await tool.installedVersion() || "(external install)";
      toolsOutput.push(`${kIndent}${tool.name}: ${version}`);
      toolsJson[tool.name] = {
        version,
      };
    }
    for (const tool of tools.notInstalled) {
      toolsOutput.push(`${kIndent}${tool.name}: (not installed)`);
      toolsJson[tool.name] = {
        installed: false,
      };
    }
  };
  if (conf.jsonResult) {
    await toolsCb();
  } else {
    await withSpinner({
      message: toolsMessage,
      doneMessage: toolsMessage + "OK",
    }, toolsCb);
  }
  toolsOutput.forEach((out) => checkInfoMsg(conf, out));
  checkInfoMsg(conf, "");

  const latexMessage = "Checking LaTeX....................";
  const latexOutput: string[] = [];
  const latexJson: Record<string, unknown> = {};
  if (conf.jsonResult) {
    conf.jsonResult.latex = latexJson;
  }
  const latexCb = async () => {
    const tlContext = await texLiveContext(true);
    if (tlContext.hasTexLive) {
      const version = await tlVersion(tlContext);

      if (tlContext.usingGlobal) {
        const tlMgrPath = await which("tlmgr");

        latexOutput.push(`${kIndent}Using: Installation From Path`);
        if (tlMgrPath) {
          latexOutput.push(`${kIndent}Path: ${dirname(tlMgrPath)}`);
          latexJson["path"] = dirname(tlMgrPath);
          latexJson["source"] = "global";
        }
      } else {
        latexOutput.push(`${kIndent}Using: TinyTex`);
        if (tlContext.binDir) {
          latexOutput.push(`${kIndent}Path: ${tlContext.binDir}`);
          latexJson["path"] = tlContext.binDir;
          latexJson["source"] = "tinytex";
        }
      }
      latexOutput.push(`${kIndent}Version: ${version}`);
      latexJson["version"] = version;
    } else {
      latexOutput.push(`${kIndent}Tex:  (not detected)`);
      latexJson["installed"] = false;
    }
  };
  if (conf.jsonResult) {
    await latexCb();
  } else {
    await withSpinner({
      message: latexMessage,
      doneMessage: latexMessage + "OK",
    }, latexCb);
  }
  latexOutput.forEach((out) => checkInfoMsg(conf, out));
  checkInfoMsg(conf, "");

  const chromeHeadlessMessage = "Checking Chrome Headless....................";
  const chromeHeadlessOutput: string[] = [];
  const chromeJson: Record<string, unknown> = {};
  if (conf.jsonResult) {
    conf.jsonResult.chrome = chromeJson;
  }
  const chromeCb = async () => {
    const chromeDetected = await findChrome();
    const chromiumQuarto = tools.installed.find((tool) =>
      tool.name === "chromium"
    );
    if (chromeDetected.path !== undefined) {
      chromeHeadlessOutput.push(`${kIndent}Using: Chrome found on system`);
      chromeHeadlessOutput.push(
        `${kIndent}Path: ${chromeDetected.path}`,
      );
      if (chromeDetected.source) {
        chromeHeadlessOutput.push(`${kIndent}Source: ${chromeDetected.source}`);
      }
      chromeJson["path"] = chromeDetected.path;
      chromeJson["source"] = chromeDetected.source;
    } else if (chromiumQuarto !== undefined) {
      chromeJson["source"] = "quarto";
      chromeHeadlessOutput.push(
        `${kIndent}Using: Chromium installed by Quarto`,
      );
      if (chromiumQuarto?.binDir) {
        chromeHeadlessOutput.push(
          `${kIndent}Path: ${chromiumQuarto?.binDir}`,
        );
        chromeJson["path"] = chromiumQuarto?.binDir;
      }
      chromeHeadlessOutput.push(
        `${kIndent}Version: ${chromiumQuarto.installedVersion}`,
      );
      chromeJson["version"] = chromiumQuarto.installedVersion;
    } else {
      chromeHeadlessOutput.push(`${kIndent}Chrome:  (not detected)`);
      chromeJson["installed"] = false;
    }
  };
  if (conf.jsonResult) {
    await chromeCb();
  } else {
    await withSpinner({
      message: chromeHeadlessMessage,
      doneMessage: chromeHeadlessMessage + "OK",
    }, chromeCb);
  }
  chromeHeadlessOutput.forEach((out) => checkInfoMsg(conf, out));
  checkInfoMsg(conf, "");

  const kMessage = "Checking basic markdown render....";
  const markdownRenderJson: Record<string, unknown> = {};
  if (conf.jsonResult) {
    conf.jsonResult.render = {
      markdown: markdownRenderJson,
    };
  }
  const markdownRenderCb = async () => {
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
      if (!conf.jsonResult) {
        throw result.error;
      } else {
        markdownRenderJson["error"] = result.error;
      }
    } else {
      markdownRenderJson["ok"] = true;
    }
  };

  if (conf.jsonResult) {
    await markdownRenderCb();
  } else {
    await withSpinner({
      message: kMessage,
      doneMessage: kMessage + "OK\n",
    }, markdownRenderCb);
  }
}

async function checkJupyterInstallation(conf: CheckConfiguration) {
  const kMessage = "Checking Python 3 installation....";
  const jupyterJson: Record<string, unknown> = {};
  if (conf.jsonResult) {
    (conf.jsonResult.tools as Record<string, unknown>).jupyter = jupyterJson;
  }
  let caps: JupyterCapabilities | undefined;
  if (conf.jsonResult) {
    caps = await jupyterCapabilities();
  } else {
    await withSpinner({
      message: kMessage,
      doneMessage: false,
    }, async () => {
      caps = await jupyterCapabilities();
    });
  }
  if (caps) {
    checkCompleteMessage(conf, kMessage + "OK");
    if (conf.jsonResult) {
      jupyterJson["capabilities"] = await jupyterCapabilitiesJson(caps);
    } else {
      checkInfoMsg(conf, await jupyterCapabilitiesMessage(caps, kIndent));
    }
    checkInfoMsg(conf, "");
    if (caps.jupyter_core) {
      if (await jupyterKernelspecForLanguage("python")) {
        const kJupyterMessage = "Checking Jupyter engine render....";
        if (conf.jsonResult) {
          await checkJupyterRender(conf);
        } else {
          await withSpinner({
            message: kJupyterMessage,
            doneMessage: kJupyterMessage + "OK\n",
          }, async () => {
            await checkJupyterRender(conf);
          });
        }
      } else {
        jupyterJson["kernels"] = [];
        checkInfoMsg(
          conf,
          kIndent + "NOTE: No Jupyter kernel for Python found",
        );
        checkInfoMsg(conf, "");
      }
    } else {
      const installMessage = jupyterInstallationMessage(caps, kIndent);
      checkInfoMsg(conf, installMessage);
      checkInfoMsg(conf, "");
      jupyterJson["installed"] = false;
      jupyterJson["how-to-install"] = installMessage;
      const envMessage = jupyterUnactivatedEnvMessage(caps, kIndent);
      if (envMessage) {
        checkInfoMsg(conf, envMessage);
        checkInfoMsg(conf, "");
        jupyterJson["env"] = {
          "warning": envMessage,
        };
      }
    }
  } else {
    checkCompleteMessage(conf, kMessage + "(None)\n");
    const msg = pythonInstallationMessage(kIndent);
    jupyterJson["installed"] = false;
    jupyterJson["how-to-install-python"] = msg;
    checkInfoMsg(conf, msg);
    checkInfoMsg(conf, "");
  }
}

async function checkJupyterRender(conf: CheckConfiguration) {
  const {
    services,
  } = conf;
  const json: Record<string, unknown> = {};
  if (conf.jsonResult) {
    (conf.jsonResult.render as Record<string, unknown>).jupyter = json;
  }
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
    if (!conf.jsonResult) {
      throw result.error;
    } else {
      json["error"] = result.error;
    }
  } else {
    json["ok"] = true;
  }
}

async function checkKnitrInstallation(conf: CheckConfiguration) {
  const kMessage = "Checking R installation...........";
  let caps: KnitrCapabilities | undefined;
  let rBin: string | undefined;
  const json: Record<string, unknown> = {};
  if (conf.jsonResult) {
    (conf.jsonResult.tools as Record<string, unknown>).knitr = json;
  }
  const knitrCb = async () => {
    rBin = await checkRBinary();
    caps = await knitrCapabilities(rBin);
  };
  if (conf.jsonResult) {
    await knitrCb();
  } else {
    await withSpinner({
      message: kMessage,
      doneMessage: false,
    }, knitrCb);
  }
  if (rBin && caps) {
    checkCompleteMessage(conf, kMessage + "OK");
    checkInfoMsg(conf, knitrCapabilitiesMessage(caps, kIndent));
    checkInfoMsg(conf, "");
    if (caps.packages.rmarkdownVersOk && caps.packages.knitrVersOk) {
      const kKnitrMessage = "Checking Knitr engine render......";
      if (conf.jsonResult) {
        await checkKnitrRender(conf);
      } else {
        await withSpinner({
          message: kKnitrMessage,
          doneMessage: kKnitrMessage + "OK\n",
        }, async () => {
          await checkKnitrRender(conf);
        });
      }
    } else {
      // show install message if not available
      // or update message if not up to date
      json["installed"] = false;
      if (!caps.packages.knitr || !caps.packages.knitrVersOk) {
        const msg = knitrInstallationMessage(
          kIndent,
          "knitr",
          !!caps.packages.knitr && !caps.packages.knitrVersOk,
        );
        checkInfoMsg(conf, msg);
        json["how-to-install-knitr"] = msg;
      }
      if (!caps.packages.rmarkdown || !caps.packages.rmarkdownVersOk) {
        const msg = knitrInstallationMessage(
          kIndent,
          "rmarkdown",
          !!caps.packages.rmarkdown && !caps.packages.rmarkdownVersOk,
        );
        checkInfoMsg(conf, msg);
        json["how-to-install-rmarkdown"] = msg;
      }
      checkInfoMsg(conf, "");
    }
  } else if (rBin === undefined) {
    checkCompleteMessage(conf, kMessage + "(None)\n");
    const msg = rInstallationMessage(kIndent);
    checkInfoMsg(conf, msg);
    json["installed"] = false;
    checkInfoMsg(conf, "");
  } else if (caps === undefined) {
    json["installed"] = false;
    checkCompleteMessage(conf, kMessage + "(None)\n");
    const msgs = [
      `R succesfully found at ${rBin}.`,
      "However, a problem was encountered when checking configurations of packages.",
      "Please check your installation of R.",
    ];
    msgs.forEach((msg) => {
      checkInfoMsg(conf, msg);
    });
    json["error"] = msgs.join("\n");
    checkInfoMsg(conf, "");
  }
}

async function checkKnitrRender(conf: CheckConfiguration) {
  const {
    services,
  } = conf;
  const json: Record<string, unknown> = {};
  if (conf.jsonResult) {
    (conf.jsonResult.render as Record<string, unknown>).knitr = json;
  }
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
    if (!conf.jsonResult) {
      throw result.error;
    } else {
      json["error"] = result.error;
    }
  } else {
    json["ok"] = true;
  }
}
