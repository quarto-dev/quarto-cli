/*
* install.ts
*
* Copyright (C) 2020 by RStudio, PBC
*
*/
import { message } from "../../core/console.ts";
import { tinyTexInstallable } from "./tools/tinytex.ts";

// Installable Tool interface
export interface InstallableTool {
  name: string;
  installed: () => Promise<boolean>;
  prereqs: InstallPreReq[];
  install: (msg: InstallContext) => Promise<void>;
  // return true if restart is required, false if not
  postinstall: (msg: InstallContext) => Promise<boolean>;
}

// InstallContext provides the API for installable tools
// InstallableTools can use the context to show progress, show info, etc...
export interface InstallContext {
  workingDir: string;
  info: (msg: string) => void;
  error: (msg: string) => void;
  progress: (
    progress: number,
    total: number,
    precision?: number,
    units?: string,
  ) => void;
  download: (name: string, url: string, target: string) => Promise<void>;
  props: { [key: string]: unknown };
}

// Prerequisites to installation. These will be checked before installation
// and if any return false, the message will be displaed and installation will be
// halted
export interface InstallPreReq {
  check: () => Promise<boolean>;
  os: string[];
  notMetMessage: string;
}

// The tools that are available to install
const kInstallableTools: { [key: string]: InstallableTool } = {
  tinytex: tinyTexInstallable,
};

export function toolNames(): string[] {
  const tools: string[] = [];
  Object.keys(kInstallableTools).forEach((key) => {
    const tool = kInstallableTools[key];
    tools.push(tool.name.toLowerCase());
  });
  return tools;
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

      // See if it is already installed
      const alreadyInstalled = await installableTool.installed();
      if (alreadyInstalled) {
        // Already installed, do nothing
        context.info(`${name} is already installed.`);
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
            context.error(prereq.notMetMessage);
            return Promise.reject();
          }
        }

        // Do the install
        await installableTool.install(context);

        // post install
        const restartRequired = await installableTool.postinstall(context);

        context.info("\nInstallation successful");
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
    message(
      `Could not install '${name}'- try again with one of the following:`,
    );
    toolNames().forEach((name) =>
      message("quarto install " + name, { indent: 2 })
    );
  }
}

const installContext = (workingDir: string): InstallContext => {
  const installMessaging = {
    info: (msg: string) => {
      message(msg);
    },
    error: (msg: string) => {
      message(msg);
    },
    progress: (
      progress: number,
      total: number,
      precision?: number,
      units?: string,
    ) => {
      precision = precision || 1;
      const msg = units
        ? `[${progress.toFixed(precision)}/${
          total.toFixed(precision)
        } ${units}]`
        : `[${progress.toFixed(precision)}/${total.toFixed(precision)}]`;

      const progressBar = asciiProgressBar((progress / total) * 100);
      message(
        `\r${progressBar} ${msg}`,
        { newline: progress === total },
      );
    },
  };

  return {
    download: async (
      name: string,
      url: string,
      target: string,
    ) => {
      installMessaging.info(
        `Downloading ${name}`,
      );

      // Fetch the data
      const response = await fetch(
        url,
        {
          redirect: "follow",
        },
      );

      // Write the data to a file
      if (response.status === 200 && response.body) {
        const pkgFile = await Deno.open(target, { create: true, write: true });

        const contentLength =
          (response.headers.get("content-length") || 0) as number;
        const contentLengthMb = contentLength / 1024 / 1024;

        let totalLength = 0;
        for await (const chunk of response.body) {
          await Deno.writeAll(pkgFile, chunk);
          totalLength = totalLength + chunk.length;
          if (contentLength > 0) {
            installMessaging.progress(
              totalLength / 1024 / 1024,
              contentLengthMb,
              1,
              "MB",
            );
          }
        }
        pkgFile.close();
      } else {
        installMessaging.error(
          `download failed (HTTP status ${response.status} - ${response.statusText})`,
        );
        return Promise.reject();
      }
    },
    workingDir,
    ...installMessaging,
    props: {},
  };
};

// Creates an ascii progress bar of a specified width, displaying a percentage complete
function asciiProgressBar(percent: number, width?: number): string {
  width = width || 25;
  const segsComplete = Math.floor(percent / (100 / width));

  let progressBar = "[";
  for (let i = 0; i < width; i++) {
    progressBar = progressBar + (i < segsComplete ? "#" : " ");
  }
  progressBar = progressBar + "]";
  return progressBar;
}
