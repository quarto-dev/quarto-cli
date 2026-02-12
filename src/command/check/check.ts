/*
 * check.ts
 *
 * Copyright (C) 2021-2022 Posit Software, PBC
 */

import { info } from "../../deno_ral/log.ts";

import { render } from "../render/render-shared.ts";
import { renderServices } from "../render/render-services.ts";

import { completeMessage, withSpinner } from "../../core/console.ts";
import { quartoConfig } from "../../core/quarto.ts";
import {
  cacheCodePage,
  clearCodePageCache,
  readCodePage,
} from "../../core/windows.ts";
import { RenderServiceWithLifetime } from "../render/types.ts";
import { execProcess } from "../../core/process.ts";
import { pandocBinaryPath } from "../../core/resources.ts";
import { lines } from "../../core/text.ts";
import { satisfies } from "semver/mod.ts";
import { dartCommand } from "../../core/dart-sass.ts";
import { allTools, installableTool } from "../../tools/tools.ts";
import { texLiveContext, tlVersion } from "../render/latexmk/texlive.ts";
import { which } from "../../core/path.ts";
import { dirname } from "../../deno_ral/path.ts";
import { notebookContext } from "../../render/notebook/notebook-context.ts";
import { typstBinaryPath } from "../../core/typst.ts";
import { quartoCacheDir } from "../../core/appdirs.ts";
import { isWindows } from "../../deno_ral/platform.ts";
import { makeStringEnumTypeEnforcer } from "../../typing/dynamic.ts";
import { findChrome } from "../../core/puppeteer.ts";
import {
  chromeHeadlessShellExecutablePath,
  chromeHeadlessShellInstallDir,
  readInstalledVersion,
} from "../../tools/impl/chrome-headless-shell.ts";
import { executionEngines } from "../../execute/engine.ts";

export function getTargets(): readonly string[] {
  const checkableEngineNames = executionEngines()
    .filter((engine) => engine.checkInstallation)
    .map((engine) => engine.name);

  return ["install", "info", ...checkableEngineNames, "versions", "all"];
}

export type Target = string;
export function enforceTargetType(value: unknown): Target {
  const targets = getTargets();
  return makeStringEnumTypeEnforcer(...targets)(value);
}

const kIndent = "      ";

type CheckJsonResult = Record<string, unknown>;

export type CheckConfiguration = {
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

    // Fixed checks (non-engine)
    for (
      const [name, checker] of [
        ["info", checkInfo],
        ["versions", checkVersions],
        ["install", checkInstall],
      ] as const
    ) {
      if (target === name || target === "all") {
        await checker(conf);
      }
    }

    // Dynamic engine checks
    for (const engine of executionEngines()) {
      if (
        engine.checkInstallation && (target === engine.name || target === "all")
      ) {
        await engine.checkInstallation(conf);
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
  const versionConstraints: [string | undefined, string, string][] = [
    [pandocVersion, "3.8.3", "Pandoc"],
    [sassVersion, "1.87.0", "Dart Sass"],
    [denoVersion, "2.4.5", "Deno"],
    [typstVersion, "0.14.2", "Typst"],
  ];
  const checkData: [string | undefined, string, string][] = versionConstraints
    .map(([version, ver, name]) => [
      version,
      strict ? ver : `>=${ver}`,
      name,
    ]);
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
    const chromeHsPath = chromeHeadlessShellExecutablePath();
    const chromiumTool = installableTool("chromium");
    const chromiumQuarto = chromiumTool && await chromiumTool.installed()
      ? chromiumTool
      : undefined;
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
    } else if (chromeHsPath !== undefined) {
      const version = readInstalledVersion(chromeHeadlessShellInstallDir());
      chromeJson["source"] = "quarto-chrome-headless-shell";
      chromeHeadlessOutput.push(
        `${kIndent}Using: Chrome Headless Shell installed by Quarto`,
      );
      chromeHeadlessOutput.push(`${kIndent}Path: ${chromeHsPath}`);
      chromeJson["path"] = chromeHsPath;
      if (version) {
        chromeHeadlessOutput.push(`${kIndent}Version: ${version}`);
        chromeJson["version"] = version;
      }
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
