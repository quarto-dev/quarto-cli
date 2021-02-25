/*
* cmd.ts
*
* Copyright (C) 2020 by RStudio, PBC
*
*/

import { Command } from "cliffy/command/mod.ts";

import { message } from "../../core/console.ts";
import { getenv } from "../../core/env.ts";
import { which } from "../../core/path.ts";
import { execProcess } from "../../core/process.ts";
import { binaryPath, rBinaryPath } from "../../core/resources.ts";
import { version } from "../../core/version.ts";

import { tinyTexInstallDir } from "../install/tools/tinytex.ts";
import { tlVersion } from "../render/latekmk/texlive.ts";
import { pythonBinary } from "../../execute/jupyter/jupyter.ts";

export const environmentCommand = new Command()
  .name("env")
  .description("Prints Quarto environment information")
  .option("--optional", "Print optional environment information")
  // deno-lint-ignore no-explicit-any
  .action(async (options: any, _dir?: string) => {
    const optional = options["optional"];

    message(`Quarto:`);
    printEnv("Bin Path", getenv("QUARTO_BIN_PATH"));
    printEnv("Share Path", getenv("QUARTO_SHARE_PATH"));
    printEnv("Version", version());
    message("");

    for (const envData of envDatas) {
      const path = await envData.path();
      const version = await envData.readValue();
      if (path && version) {
        message(`${envData.name}:`);
        printEnv("Path", path);
        printEnv("Version", version);
        if (envData.options?.newLine) {
          message("");
        }
      } else if (envData.warnIfMissing || optional) {
        message(`${envData.name}:`);
        message("(Not found)\n", { indent: 1 });
      } else {
        // This is optional, so will just allow it through silently.
      }
    }
  });

const envDatas: EnvironmentData[] = [
  binaryEnv("Deno", "deno", true),
  binaryEnv("Pandoc", "pandoc", true),
  {
    name: "TeXLive",
    warnIfMissing: true,
    path: () => {
      return Promise.resolve(tinyTexInstallDir());
    },
    readValue: () => {
      return tlVersion();
    },
    options: { newLine: true },
  },
  rBinaryEnv("R", "R", false),
  pythonEnv("python", false),
  pythonEnv("jupyter", false),
  pythonEnv("jupytext", false, { newLine: true }),
];

function printEnv(name: string, value: string) {
  message(`${name}:`, { indent: 1 });
  message(value, { indent: 2 });
}

interface EnvironmentData {
  name: string;
  warnIfMissing: boolean;
  path: () => Promise<string | undefined>;
  readValue: () => Promise<string | undefined>;
  options?: EnvironmentDataOutputOptions;
}

interface EnvironmentDataOutputOptions {
  newLine: boolean;
}

function binaryEnv(
  name: string,
  cmd: string,
  warnIfMissing: boolean,
  options?: EnvironmentDataOutputOptions,
): EnvironmentData {
  return {
    name,
    warnIfMissing,
    path: () => {
      return Promise.resolve(binaryPath(cmd));
    },
    readValue: async () => {
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
  warnIfMissing: boolean,
  options?: EnvironmentDataOutputOptions,
): EnvironmentData {
  return {
    name,
    warnIfMissing,
    path: async () => {
      let path = rBinaryPath(cmd);
      if (path === cmd) {
        path = await which(cmd) ||
          cmd;
      }
      return Promise.resolve(path);
    },
    readValue: async () => {
      const res = await execProcess({
        cmd: [rBinaryPath(cmd), "--version"],
        stdout: "piped",
        stderr: "piped",
      });
      return res.stdout || res.stderr;
    },
    options,
  };
}

function pythonEnv(
  name: string,
  warnIfMissing: boolean,
  options?: EnvironmentDataOutputOptions,
): EnvironmentData {
  return {
    name: name,
    warnIfMissing,
    path: () => {
      return Promise.resolve(pythonBinary(name));
    },
    readValue: async () => {
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
