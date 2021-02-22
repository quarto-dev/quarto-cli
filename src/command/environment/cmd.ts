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
import { binaryPath } from "../../core/resources.ts";
import { pythonBinary } from "../../execute/jupyter/jupyter.ts";
import { tinyTexInstallDir } from "../install/tools/tinytex.ts";
import { tlVersion } from "../render/latekmk/texlive.ts";

export const environmentCommand = new Command()
  .name("env")
  .description("Prints Quarto environment information")
  // deno-lint-ignore no-explicit-any
  .action(async (_options: any, _dir?: string) => {
    message(`Quarto:`);
    printEnv("Bin Path", getenv("QUARTO_BIN_PATH"));
    printEnv("Share Path", getenv("QUARTO_SHARE_PATH"));
    message("");

    for (const envData of envDatas) {
      message(`${envData.name}:`);
      const path = await envData.path();
      const version = await envData.readValue();
      if (path && version) {
        printEnv("Path", path);
        printEnv("Version", version);
        if (envData.options?.newLine) {
          message("");
        }
      } else {
        message("(Not found)\n", { indent: 1 });
      }
    }
  });

const envDatas: EnvironmentData[] = [
  binaryEnv("Deno", "deno"),
  binaryEnv("Pandoc", "pandoc"),
  {
    name: "TeXLive",
    path: () => {
      return Promise.resolve(tinyTexInstallDir());
    },
    readValue: () => {
      return tlVersion();
    },
    options: { newLine: true },
  },
  plainEnv("RScript", "RScript"),
  pythonEnv(),
  pythonEnv("Jupyter"),
  pythonEnv("JupyText", { newLine: true }),
];

function printEnv(name: string, value: string) {
  message(`${name}:`, { indent: 1 });
  message(value, { indent: 2 });
}

interface EnvironmentData {
  name: string;
  path: () => Promise<string | undefined>;
  readValue: () => Promise<string | undefined>;
  options?: EnvironmentDataOutputOptions;
}

interface EnvironmentDataOutputOptions {
  newLine: boolean;
}

function plainEnv(name: string, cmd: string) {
  return {
    name,
    path: async () => {
      return await which(cmd);
    },
    readValue: async () => {
      const res = await execProcess({
        cmd: [cmd, "--version"],
        stdout: "piped",
        stderr: "piped",
      });
      return res.stderr;
    },
  };
}

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

function pythonEnv(
  name?: string,
  options?: EnvironmentDataOutputOptions,
): EnvironmentData {
  return {
    name: name || "Python",
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
        });
        return r.stdout;
      } catch (e) {
        return undefined;
      }
    },
    options,
  };
}
