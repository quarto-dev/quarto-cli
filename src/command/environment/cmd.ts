/*
* cmd.ts
*
* Copyright (C) 2020 by RStudio, PBC
*
*/

import { Command } from "cliffy/command/mod.ts";

import { version } from "../../quarto.ts";

import { message } from "../../core/console.ts";
import { getenv } from "../../core/env.ts";
import { which } from "../../core/path.ts";
import { execProcess } from "../../core/process.ts";
import { binaryPath } from "../../core/resources.ts";

import { tinyTexInstallDir } from "../install/tools/tinytex.ts";
import { tlVersion } from "../render/latekmk/texlive.ts";
import { pythonBinary } from "../../execute/jupyter/jupyter.ts";

export const environmentCommand = new Command()
  .name("env")
  .description("Prints Quarto environment information")
  // deno-lint-ignore no-explicit-any
  .action(async (_options: any, _dir?: string) => {
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
      } else if (envData.warnIfMissing) {
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
  plainEnv("RScript", "RScript", false),
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

function plainEnv(name: string, cmd: string, warnIfMissing: boolean) {
  return {
    name,
    warnIfMissing,
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
