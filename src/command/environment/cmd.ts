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

import { tinyTexInstallDir } from "../install/tools/tinytex.ts";
import { tlVersion } from "../render/latekmk/texlive.ts";
import { pythonBinary } from "../../execute/jupyter/jupyter.ts";
import { QuartoConfig, quartoConfig } from "../../core/quarto.ts";

interface EnvironmentData {
  name: string;
  path: () => Promise<string | undefined>;
  version: () => Promise<string | undefined>;
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
        `${quartoConfig.binPath()}\n${quartoConfig.sharePath()}`,
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

async function printEnvironmentData(
  envData: EnvironmentData,
  optional: boolean,
) {
  const path = await envData.path();
  const version = await envData.version();
  if (path && version) {
    message(`${colors.bold(envData.name)}:`);
    printEnv("Path", path);
    printEnv("Version", version);
    if (envData.options?.newLine) {
      message("");
    }
  } else if (!optional) {
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
