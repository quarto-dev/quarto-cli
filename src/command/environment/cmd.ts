/*
* cmd.ts
*
* Copyright (C) 2020 by RStudio, PBC
*
*/
import { Command } from "cliffy/command/mod.ts";
import { info } from "log/mod.ts";

import { spinner } from "../../core/console.ts";
import { quartoConfig } from "../../core/quarto.ts";
import { pythonEnv, rBinaryEnv, rPackageEnv } from "./execution.ts";
import { binaryEnv, dartSassEnv, QuartoEnv, tinyTexEnv } from "./bin.ts";

export interface EnvironmentData {
  name: string;
  path: () => Promise<string | Record<string, string> | undefined>;
  version: () => Promise<string | undefined>;
  metadata?: () => Promise<Record<string, string> | undefined>;
  options?: EnvironmentDataOutputOptions;
}

export interface EnvironmentDataOutputOptions {
  newline: boolean;
}

export const environmentCommand = new Command()
  .name("env")
  .arguments("[type:string]")
  .description(
    "Prints Quarto environment information. Type can be one of all, r, python",
  )
  // deno-lint-ignore no-explicit-any
  .action(async (_options: any, type?: string) => {
    const envDataRequired: EnvironmentData[] = [];
    const envDataOptional: EnvironmentData[] = [];
    switch (type) {
      case "all":
        envDataRequired.push(QuartoEnv(quartoConfig));
        envDataRequired.push(...required);
        envDataRequired.push(tinyTexEnv());
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
        envDataOptional.push(tinyTexEnv());
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
  dartSassEnv(),
];

const r: EnvironmentData[] = [
  rBinaryEnv("R", "R", { newline: false }),
  rPackageEnv(),
];

const python: EnvironmentData[] = [
  pythonEnv("python"),
  pythonEnv("jupyter"),
];

async function printEnvironmentData(
  envData: EnvironmentData,
  optional: boolean,
) {
  const cancelSpinner = spinner(`${envData.name}...`);
  const getMetadata = (envData: EnvironmentData) => {
    if (envData.metadata) {
      return envData.metadata();
    }
    return undefined;
  };

  const path = await envData.path();
  const version = await envData.version();
  const metadata = await getMetadata(envData);
  cancelSpinner(false);

  if (path || version || metadata) {
    // Print the title
    info(envData.name, { bold: true });

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
    if (envData.options?.newline) {
      info("");
    }
  } else if (!optional) {
    // Print a not found message
    info(`${envData.name}:`);
    info("(Not found)\n", { indent: 1 });
  } else {
    // This is optional, so will just allow it through silently.
  }
}

function printEnv(name: string, value: string) {
  info(`${name}:`, { indent: 1 });
  info(value, { indent: 2 });
}
