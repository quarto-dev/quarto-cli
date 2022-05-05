/*
* install.ts
*
* Copyright (C) 2020 by RStudio, PBC
*
*/

import { info } from "log/mod.ts";
import { withSpinner } from "../../core/console.ts";
import { logError } from "../../core/log.ts";

import {
  InstallableTool,
  InstallContext,
  ToolConfigurationState,
  ToolSummaryData,
} from "./types.ts";
import { tinyTexInstallable } from "./tools/tinytex.ts";
import { chromiumInstallable } from "./tools/chromium.ts";
import { downloadWithProgress } from "../../core/download.ts";

// The tools that are available to install
const kInstallableTools: { [key: string]: InstallableTool } = {
  tinytex: tinyTexInstallable,
  chromium: chromiumInstallable,
};

export function installableTools(): string[] {
  const tools: string[] = [];
  Object.keys(kInstallableTools).forEach((key) => {
    const tool = kInstallableTools[key];
    tools.push(tool.name.toLowerCase());
  });
  return tools;
}

export async function printToolInfo(name: string) {
  name = name || "";
  // Run the install
  const installableTool = kInstallableTools[name.toLowerCase()];
  if (installableTool) {
    const response: Record<string, unknown> = {
      name: installableTool.name,
      installed: await installableTool.installed(),
      version: await installableTool.installedVersion(),
      directory: await installableTool.installDir(),
    };
    if (installableTool.binDir) {
      response["bin-directory"] = await installableTool.binDir();
    }
    if (response.installed && installableTool.verifyConfiguration) {
      response["configuration"] = await installableTool.verifyConfiguration();
    }
    Deno.stdout.writeSync(
      new TextEncoder().encode(JSON.stringify(response, null, 2) + "\n"),
    );
  }
}

export async function installTool(name: string) {
  name = name || "";
  // Run the install
  const installableTool = kInstallableTools[name.toLowerCase()];
  if (installableTool) {
    // Create a working directory for the installer to use
    const workingDir = Deno.makeTempDirSync();
    try {
      // The context for the installers
      const context = installContext(workingDir);
      context.info(`Installing ${name}`);

      // See if it is already installed
      const alreadyInstalled = await installableTool.installed();
      if (alreadyInstalled) {
        // Already installed, do nothing
        context.error(`Install canceled - ${name} is already installed.`);
        return Promise.reject();
      } else {
        // Prereqs for this platform
        const platformPrereqs = installableTool.prereqs.filter((prereq) =>
          prereq.os.includes(Deno.build.os)
        );

        // Check to see whether any prerequisites are satisfied
        for (const prereq of platformPrereqs) {
          const met = await prereq.check();
          if (!met) {
            context.error(prereq.message);
            return Promise.reject();
          }
        }

        // Fetch the package information
        const pkgInfo = await installableTool.preparePackage(context);

        // Do the install
        await installableTool.install(pkgInfo, context);

        // post install
        const restartRequired = await installableTool.afterInstall(context);

        context.info("Installation successful\n");
        if (restartRequired) {
          context.info(
            "To complete this installation, please restart your system.",
          );
        }
      }
    } finally {
      // Cleanup the working directory
      Deno.removeSync(workingDir, { recursive: true });
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

export async function uninstallTool(name: string) {
  const installableTool = kInstallableTools[name.toLowerCase()];
  if (installableTool) {
    const installed = await installableTool.installed();
    if (installed) {
      const workingDir = Deno.makeTempDirSync();
      const context = installContext(workingDir);

      // Emit initial message
      context.info(`Uninstalling ${name}`);

      try {
        // The context for the installers
        await installableTool.uninstall(context);
        info(`Uninstallation successful\n`);
      } catch (e) {
        logError(e);
      } finally {
        Deno.removeSync(workingDir, { recursive: true });
      }
    } else {
      info(
        `${name} is not installed Use 'quarto install ${name} to install it.`,
      );
    }
  }
}

export async function updateTool(name: string) {
  const summary = await toolSummary(name);
  const installableTool = kInstallableTools[name];

  if (installableTool && summary && summary.installed) {
    const workingDir = Deno.makeTempDirSync();
    const context = installContext(workingDir);
    try {
      context.info(
        `Updating ${installableTool.name} from ${summary.installedVersion} to ${summary.latestRelease.version}`,
      );

      // Fetch the package
      const pkgInfo = await installableTool.preparePackage(context);

      context.info(`Removing ${summary.installedVersion}`);

      // Uninstall the existing version of the tool
      await installableTool.uninstall(context);

      context.info(`Installing ${summary.latestRelease.version}`);

      // Install the new package
      await installableTool.install(pkgInfo, context);

      context.info("Finishing update");
      // post install
      const restartRequired = await installableTool.afterInstall(context);

      context.info("Update successful\n");
      if (restartRequired) {
        context.info(
          "To complete this update, please restart your system.",
        );
      }
    } catch (e) {
      logError(e);
    } finally {
      Deno.removeSync(workingDir, { recursive: true });
    }
  } else {
    info(
      `${name} is not installed Use 'quarto install ${name} to install it.`,
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

const installContext = (workingDir: string): InstallContext => {
  const installMessaging = {
    info: (msg: string) => {
      info(msg);
    },
    error: (msg: string) => {
      info(msg);
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
        installMessaging.error(
          error.message,
        );
        return Promise.reject();
      }
    },
    workingDir,
    ...installMessaging,
    props: {},
  };
};
