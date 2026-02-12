/*
 * install.ts
 *
 * Copyright (C) 2020-2022 Posit Software, PBC
 */

import { info, warning } from "../deno_ral/log.ts";
import { withSpinner } from "../core/console.ts";
import { logError } from "../core/log.ts";
import { os as platformOs } from "../deno_ral/platform.ts";

import {
  InstallableTool,
  InstallContext,
  kUpdatePath,
  ToolConfigurationState,
  ToolSummaryData,
} from "./types.ts";
import { tinyTexInstallable } from "./impl/tinytex.ts";
import { chromiumInstallable } from "./impl/chromium.ts";
import { chromeHeadlessShellInstallable } from "./impl/chrome-headless-shell.ts";
import { verapdfInstallable } from "./impl/verapdf.ts";
import { downloadWithProgress } from "../core/download.ts";
import { Confirm } from "cliffy/prompt/mod.ts";
import { isWSL } from "../core/platform.ts";
import { ensureDirSync, existsSync, safeRemoveSync } from "../deno_ral/fs.ts";
import { join } from "../deno_ral/path.ts";
import { expandPath, suggestUserBinPaths } from "../core/path.ts";
import { isWindows } from "../deno_ral/platform.ts";

// The tools that are available to install
const kInstallableTools: { [key: string]: InstallableTool } = {
  tinytex: tinyTexInstallable,
  // temporarily disabled until deno 1.28.* gets puppeteer support
  chromium: chromiumInstallable,
  "chrome-headless-shell": chromeHeadlessShellInstallable,
  verapdf: verapdfInstallable,
};

export async function allTools(): Promise<{
  installed: InstallableTool[];
  notInstalled: InstallableTool[];
}> {
  const installed: InstallableTool[] = [];
  const notInstalled: InstallableTool[] = [];
  const tools = installableTools();
  for (const name of tools) {
    // Find the tool
    const tool = installableTool(name);
    const isInstalled = await tool.installed();
    if (isInstalled) {
      installed.push(tool);
    } else {
      notInstalled.push(tool);
    }
  }
  return {
    installed,
    notInstalled,
  };
}

export function installableTools(): string[] {
  return Object.keys(kInstallableTools);
}

export async function printToolInfo(name: string) {
  name = name || "";
  // Run the install
  const tool = installableTool(name);
  if (tool) {
    const response: Record<string, unknown> = {
      name: tool.name,
      installed: await tool.installed(),
      version: await tool.installedVersion(),
      directory: await tool.installDir(),
    };
    if (tool.binDir) {
      response["bin-directory"] = await tool.binDir();
    }
    if (response.installed && tool.verifyConfiguration) {
      response["configuration"] = await tool.verifyConfiguration();
    }
    Deno.stdout.writeSync(
      new TextEncoder().encode(JSON.stringify(response, null, 2) + "\n"),
    );
  }
}

export function checkToolRequirement(name: string) {
  if (name.toLowerCase() === "chromium" && isWSL()) {
    // TODO: Change to a quarto-web url page ?
    const troubleshootUrl =
      "https://pptr.dev/next/troubleshooting#running-puppeteer-on-wsl-windows-subsystem-for-linux.";
    warning([
      `${name} can't be installed fully on WSL with Quarto as system requirements could be missing.`,
      `- Please do a manual installation following recommandations at ${troubleshootUrl}`,
      "- See https://github.com/quarto-dev/quarto-cli/issues/1822 for more context.",
    ].join("\n"));
    return false;
  } else if (name.toLowerCase() === "chrome-headless-shell" && isWSL()) {
    info(
      "Note: chrome-headless-shell is a headless-only binary and should work on WSL without additional system dependencies.",
    );
    return true;
  } else {
    return true;
  }
}

export async function installTool(name: string, updatePath?: boolean) {
  name = name || "";
  // Run the install
  const tool = installableTool(name);
  if (tool) {
    if (checkToolRequirement(name)) {
      // Create a working directory for the installer to use
      const workingDir = Deno.makeTempDirSync();
      try {
        // The context for the installers
        const context = installContext(workingDir, updatePath);

        context.info(`Installing ${name}`);

        // See if it is already installed
        const alreadyInstalled = await tool.installed();
        if (alreadyInstalled) {
          // Already installed, do nothing
          context.error(`Install canceled - ${name} is already installed.`);
          Deno.exit(1);
        } else {
          // Prereqs for this platform
          const platformPrereqs = tool.prereqs.filter((prereq) =>
            prereq.os.includes(platformOs)
          );

          // Check to see whether any prerequisites are satisfied
          for (const prereq of platformPrereqs) {
            const met = await prereq.check(context);
            if (!met) {
              context.error(prereq.message);
              Deno.exit(1);
            }
          }

          // Fetch the package information
          const pkgInfo = await tool.preparePackage(context);

          // Do the install
          await tool.install(pkgInfo, context);

          // post install
          const restartRequired = await tool.afterInstall(context);

          context.info("Installation successful");
          if (restartRequired) {
            context.info(
              "To complete this installation, please restart your system.",
            );
          }
        }
      } finally {
        // Cleanup the working directory
        safeRemoveSync(workingDir, { recursive: true });
      }
    }
  } else {
    // No tool found
    info(
      `Could not install '${name}'- try again with one of the following:`,
    );
    installableTools().forEach((name) =>
      info("quarto install " + name, { indent: 2 })
    );
  }
}

export async function uninstallTool(name: string, updatePath?: boolean) {
  const tool = installableTool(name);
  if (tool) {
    const installed = await tool.installed();
    if (installed) {
      const workingDir = Deno.makeTempDirSync();
      const context = installContext(workingDir, updatePath);

      // Emit initial message
      context.info(`Uninstalling ${name}`);

      try {
        // The context for the installers
        await tool.uninstall(context);
        info(`Uninstallation successful`);
      } catch (e) {
        logError(e);
      } finally {
        safeRemoveSync(workingDir, { recursive: true });
      }
    } else {
      info(
        `${name} is not installed use 'quarto install ${name} to install it.`,
      );
    }
  }
}

export async function updateTool(name: string) {
  const summary = await toolSummary(name);
  const tool = installableTool(name);

  if (tool && summary && summary.installed) {
    const workingDir = Deno.makeTempDirSync();
    const context = installContext(workingDir);
    try {
      context.info(
        `Updating ${tool.name} from ${summary.installedVersion} to ${summary.latestRelease.version}`,
      );

      // Fetch the package
      const pkgInfo = await tool.preparePackage(context);

      context.info(`Removing ${summary.installedVersion}`);

      // Uninstall the existing version of the tool
      await tool.uninstall(context);

      context.info(`Installing ${summary.latestRelease.version}`);

      // Install the new package
      await tool.install(pkgInfo, context);

      context.info("Finishing update");
      // post install
      const restartRequired = await tool.afterInstall(context);

      context.info("Update successful");
      if (restartRequired) {
        context.info(
          "To complete this update, please restart your system.",
        );
      }
    } catch (e) {
      logError(e);
    } finally {
      safeRemoveSync(workingDir, { recursive: true });
    }
  } else {
    info(
      `${name} is not installed use 'quarto install ${name.toLowerCase()} to install it.`,
    );
  }
}

export async function toolSummary(
  name: string,
): Promise<ToolSummaryData | undefined> {
  // Find the tool
  const tool = installableTool(name);

  // Information about the potential update
  if (tool) {
    const installed = await tool.installed();
    const installedVersion = await tool.installedVersion();
    const latestRelease = await tool.latestRelease();
    const configuration = tool.verifyConfiguration && installed
      ? await tool.verifyConfiguration()
      : { status: "ok" } as ToolConfigurationState;
    return { installed, installedVersion, latestRelease, configuration };
  } else {
    return undefined;
  }
}

export function installableTool(name: string) {
  return kInstallableTools[name.toLowerCase()];
}

const installContext = (
  workingDir: string,
  updatePath?: boolean,
): InstallContext => {
  const installMessaging = {
    info: (msg: string) => {
      info(msg);
    },
    error: (msg: string) => {
      info(msg);
    },
    confirm: (msg: string, def?: boolean) => {
      if (def !== undefined) {
        return Confirm.prompt({ message: msg, default: def });
      } else {
        return Confirm.prompt(msg);
      }
    },
    withSpinner,
  };

  return {
    download: async (
      name: string,
      url: string,
      target: string,
    ) => {
      try {
        await downloadWithProgress(url, `Downloading ${name}`, target);
      } catch (error) {
        // shouldn't happen, but this appeases the typechecker
        if (!(error instanceof Error)) {
          throw error;
        }
        installMessaging.error(
          error.message,
        );
        Deno.exit(1);
      }
    },
    workingDir,
    ...installMessaging,
    props: {},
    flags: {
      [kUpdatePath]: updatePath,
    },
  };
};

// Shared utility functions for --update-path functionality

/**
 * Creates a symlink for a tool binary in a user bin directory.
 * Returns true if successful, false otherwise.
 */
export async function createToolSymlink(
  binaryPath: string,
  symlinkName: string,
  context: InstallContext,
): Promise<boolean> {
  if (isWindows) {
    context.info(
      `Add the tool's directory to your PATH to use ${symlinkName} from anywhere.`,
    );
    return false;
  }

  const binPaths = suggestUserBinPaths();
  if (binPaths.length === 0) {
    context.info(
      `No suitable bin directory found in PATH. Add the tool's directory to your PATH manually.`,
    );
    return false;
  }

  for (const binPath of binPaths) {
    const expandedBinPath = expandPath(binPath);
    ensureDirSync(expandedBinPath);
    const symlinkPath = join(expandedBinPath, symlinkName);

    try {
      // Remove existing symlink if present
      if (existsSync(symlinkPath)) {
        await Deno.remove(symlinkPath);
      }
      // Create new symlink
      await Deno.symlink(binaryPath, symlinkPath);
      return true;
    } catch {
      // Try next path
      continue;
    }
  }

  context.info(
    `Could not create symlink. Add the tool's directory to your PATH manually.`,
  );
  return false;
}

/**
 * Removes a tool's symlink from user bin directories.
 */
export async function removeToolSymlink(symlinkName: string): Promise<void> {
  if (isWindows) {
    return;
  }

  const binPaths = suggestUserBinPaths();
  for (const binPath of binPaths) {
    const symlinkPath = join(expandPath(binPath), symlinkName);
    try {
      const stat = await Deno.lstat(symlinkPath);
      if (stat.isSymlink) {
        await Deno.remove(symlinkPath);
      }
    } catch {
      // Symlink doesn't exist, continue
    }
  }
}
