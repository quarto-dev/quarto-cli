/*
* cmd.ts
*
* Copyright (C) 2020 by RStudio, PBC
*
*/
import * as colors from "fmt/colors.ts";
import { Command } from "cliffy/command/mod.ts";

import { message } from "../../core/console.ts";
import { which } from "../../core/path.ts";
import { execProcess } from "../../core/process.ts";
import { binaryPath, rBinaryPath } from "../../core/resources.ts";
import { sessionTempFile } from "../../core/temp.ts";

import { tinyTexInstallDir } from "../install/tools/tinytex.ts";
import { tlVersion } from "../render/latekmk/texlive.ts";
import { pythonBinary } from "../../execute/jupyter/jupyter.ts";
import { QuartoConfig, quartoConfig } from "../../core/quarto.ts";

interface EnvironmentData {
  name: string;
  path: () => Promise<string | Record<string, string> | undefined>;
  version: () => Promise<string | undefined>;
  metadata?: () => Promise<Record<string, string>>;
  options?: EnvironmentDataOutputOptions;
}

interface EnvironmentDataOutputOptions {
  newLine: boolean;
}

export const environmentCommand = new Command()
  .name("env")
  .arguments("[type:string]")
  .description("Prints Quarto environment information")
  // deno-lint-ignore no-explicit-any
  .action(async (options: any, type?: string) => {
    const envDataRequired: EnvironmentData[] = [];
    const envDataOptional: EnvironmentData[] = [];
    switch (type) {
      case "all":
        envDataRequired.push(QuartoEnv(quartoConfig));
        envDataRequired.push(...required);
        envDataRequired.push(...optional);
        envDataRequired.push(...r);
        envDataRequired.push(...python);
        break;
      case "r":
        envDataRequired.push(...r);
        break;
      case "python":
        envDataRequired.push(...python);
        break;
      default:
        envDataRequired.push(QuartoEnv(quartoConfig));
        envDataRequired.push(...required);
        envDataOptional.push(...optional);
        envDataOptional.push(...r);
        envDataOptional.push(...python);
        break;
    }

    // Will always print, even if they are missing
    for (const envData of envDataRequired) {
      await printEnvironmentData(envData, false);
    }

    // Will only print if they are present, will be skipped
    // if not installed
    for (const envData of envDataOptional) {
      await printEnvironmentData(envData, true);
    }
  });

const required: EnvironmentData[] = [
  binaryEnv("Deno", "deno"),
  binaryEnv("Pandoc", "pandoc"),
];

const r: EnvironmentData[] = [
  rBinaryEnv("R", "R"),
  rPackageEnv(),
];

const python: EnvironmentData[] = [
  pythonEnv("python"),
  pythonEnv("jupyter"),
  pythonEnv("jupytext", { newLine: true }),
];

const optional: EnvironmentData[] = [
  {
    name: "TeXLive",
    path: () => {
      return Promise.resolve(tinyTexInstallDir());
    },
    version: () => {
      return tlVersion();
    },
    options: { newLine: true },
  },
];

function binaryEnv(
  name: string,
  cmd: string,
  options?: EnvironmentDataOutputOptions,
): EnvironmentData {
  return {
    name,
    path: () => {
      return Promise.resolve(binaryPath(cmd));
    },
    version: async () => {
      const res = await execProcess({
        cmd: [binaryPath(cmd), "--version"],
        stdout: "piped",
        stderr: "piped",
      });
      return res.stdout;
    },
    options,
  };
}

function rBinaryEnv(
  name: string,
  cmd: string,
  options?: EnvironmentDataOutputOptions,
): EnvironmentData {
  return {
    name,
    path: async () => {
      let path = rBinaryPath(cmd);
      if (path === cmd) {
        path = await which(cmd) ||
          cmd;
      }
      return Promise.resolve(path);
    },
    version: async () => {
      try {
        const res = await execProcess({
          cmd: [rBinaryPath(cmd), "--version"],
          stdout: "piped",
          stderr: "piped",
        });
        return res.stdout || res.stderr;
      } catch (e) {
        return undefined;
      }
    },
    options,
  };
}

function pythonEnv(
  name: string,
  options?: EnvironmentDataOutputOptions,
): EnvironmentData {
  return {
    name: name,
    path: () => {
      return Promise.resolve(pythonBinary(name));
    },
    version: async () => {
      try {
        const r = await execProcess({
          cmd: [
            pythonBinary(name),
            "--version",
          ],
          stdout: "piped",
          stderr: "piped",
        });
        return r.stdout;
      } catch (e) {
        return undefined;
      }
    },
    options,
  };
}

function QuartoEnv(config: QuartoConfig): EnvironmentData {
  return {
    name: "Quarto",
    path: () => {
      return Promise.resolve(
        {
          bin: quartoConfig.binPath(),
          share: quartoConfig.sharePath(),
        },
      );
    },
    version: () => {
      return Promise.resolve(
        config.isDebug() ? "DEBUG" : quartoConfig.version(),
      );
    },
    options: { newLine: true },
  };
}

function rPackageEnv(): EnvironmentData {
  return {
    name: "R Packages",
    path: () => {
      return Promise.resolve(undefined);
    },
    version: () => {
      return Promise.resolve(undefined);
    },
    metadata: async () => {
      const runR = async (code: string): Promise<string> => {
        const codePath = sessionTempFile({ suffix: ".R" });
        Deno.writeTextFileSync(
          codePath,
          code,
        );

        const result = await execProcess(
          {
            cmd: [
              rBinaryPath("Rscript"),
              codePath,
            ],
            stdout: "piped",
            stderr: "piped",
          },
        );

        return Promise.resolve(result.stdout || result.stderr || "");
      };

      // Read the required packages
      const requiredRaw = await runR(
        `ap <- available.packages(repos = "http://cran.us.r-project.org")
        packs <- tools::package_dependencies(packages = "quarto", db = ap, recursive = TRUE)
        packs <- paste(packs, collapse=",")
        packs`,
      );

      const pkgRegex = /\\\"([a-zA-Z0-9_.-]*)\\\"/g;
      const matches = requiredRaw.matchAll(pkgRegex);
      const requiredPackages: string[] = [];
      for (const match of matches) {
        requiredPackages.push(match[1]);
      }

      // Read installed packages
      const packagesRaw = await runR(`
        installedPackages <- as.data.frame(installed.packages()[,c(1,3:4)])
        installedPackages <- installedPackages[is.na(installedPackages$Priority),2,drop=FALSE]
        installedPackages`);

      const packages = packagesRaw
        .split("\n").filter((line) => {
          for (
            const pkg of requiredPackages
          ) {
            if (line.startsWith(`${pkg} `)) {
              return true;
            }
          }
          return false;
        })
        .join("\n");
      return Promise.resolve({
        packages: packages,
      });
    },
    options: { newLine: true },
  };
}

async function printEnvironmentData(
  envData: EnvironmentData,
  optional: boolean,
) {
  const getMetadata = (envData: EnvironmentData) => {
    if (envData.metadata) {
      return envData.metadata();
    }
    return undefined;
  };

  const path = await envData.path();
  const version = await envData.version();
  const metadata = await getMetadata(envData);

  if (path || version || metadata) {
    // Print the title
    message(`${colors.bold(envData.name)}:`);

    // Print the path information (single path or record of paths)
    if (path) {
      if (typeof (path) === "string") {
        printEnv("Path", path);
      } else if (path != undefined) {
        const records = path as Record<string, string>;
        Object.keys(records).forEach((key) => {
          printEnv(key, records[key]);
        });
      }
    }

    // Print any other metadata that is emitted
    if (metadata) {
      Object.keys(metadata).forEach((key) => {
        printEnv(key, metadata[key]);
      });
    }

    // Print the version
    if (version) {
      printEnv("Version", version);
    }

    // optional new line
    if (envData.options?.newLine) {
      message("");
    }
  } else if (!optional) {
    // Print a not found message
    message(`${envData.name}:`);
    message("(Not found)\n", { indent: 1 });
  } else {
    // This is optional, so will just allow it through silently.
  }
}

function printEnv(name: string, value: string) {
  message(`${name}:`, { indent: 1 });
  message(value, { indent: 2 });
}
