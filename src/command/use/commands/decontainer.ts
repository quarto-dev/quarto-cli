/*
 * devcontainer.ts
 *
 * Copyright (C) 2021-2022 Posit Software, PBC
 */

import { Command } from "cliffy/command/mod.ts";
import { initYamlIntelligenceResourcesFromFilesystem } from "../../../core/schema/utils.ts";
import { createTempContext } from "../../../core/temp.ts";
import { info } from "log/mod.ts";
import {
  inspectConfig,
  InspectedProjectConfig,
  isProjectConfig,
} from "../../../quarto-core/inspect.ts";
import { InternalError } from "../../../core/lib/error.ts";

import { join } from "path/mod.ts";
import { ensureDirSync, existsSync } from "fs/mod.ts";
import { dirname } from "path/mod.ts";
import { Table } from "cliffy/table/mod.ts";
import { Confirm } from "cliffy/prompt/mod.ts";

// Discover environment
// Validate that lock file or requirements.txt is present
// Compute defaults
//   R => RStudio, renv.lock
//   Python w/ipynb => JupyterLab, requirements.txt
//   Python / non-R => Vscode, requirements.txt

// R devcontainer template
// https://github.com/rocker-org/devcontainer-templates/tree/main/src/r-ver
// Python 3
// https://github.com/devcontainers/templates/tree/main/src/python

// Julia TBD

// quarto inspect engines

interface DevContainer {
  name: string;
  image: string;
  customizations?: {
    vscode?: {
      extensions?: string[];
    };
  };
}

// The devcontainer can be ina  file, directory, or a subdirectory (where multiple subdirectories
// could be used to provide the user with a choice of dev containers)
type pathType = "file" | "directory" | "subdirectory";

// The current global image that we use for the devcontainer
const kRootDevContainerImage = "ghcr.io/quarto-dev/quarto-full:1.4.266";

// Options
// name - the name of the devcontainer

export const useDevContainerCommand = new Command()
  .name("devcontainer")
  .description(
    "Configure a Development Container for this project.",
  )
  .option(
    "--no-prompt",
    "Do not prompt to confirm actions",
  )
  .example(
    "Set up a Development Container",
    "quarto use devcontainer",
  )
  .action(async (_options: { prompt?: boolean }) => {
    await initYamlIntelligenceResourcesFromFilesystem();
    const temp = createTempContext();
    try {
      info("Inspecting configuration");
      const config = await inspectConfig(Deno.cwd());

      let title = "Quarto devcontainer";
      if (isProjectConfig(config)) {
        const projectConfig = config as InspectedProjectConfig;
        title = projectConfig.config.project.title || title;
      }

      // The devcontainer JSON that we are building
      const devcontainer: DevContainer = {
        name: title,
        image: containerImage(config.engines),
        customizations: {
          vscode: {
            extensions: ["quarto.quarto"],
          },
        },
      };

      // Where to write the dev conatiner json
      const outputPath = devcontainerPath();

      // Print a summary of devconatiner
      const proceed = await confirmChanges(devcontainer);
      if (proceed) {
        // Validate that the path doesn't exist
        if (!existsSync(outputPath) || await confirmOverwrite(outputPath)) {
          ensureDirSync(dirname(outputPath));

          // Write the devcontainer JSON
          const devcontainerJson = JSON.stringify(devcontainer, undefined, 2);
          Deno.writeTextFileSync(outputPath, devcontainerJson);

          info("Development container successfully created.");
        }
      }
    } finally {
      temp.cleanup();
    }
  });

const confirmChanges = async (devContainer: DevContainer) => {
  const rows: string[][] = [];
  rows.push(["title", devContainer.name]);
  rows.push(["image", devContainer.image]);

  const table = new Table(...rows);
  info(
    `\nA development container with the following options will be created:\n${table.toString()}`,
  );
  const question = "Would you like to continue";
  return await Confirm.prompt({ message: question, default: true });
};

const confirmOverwrite = async (path: string) => {
  info(
    `\nA development container at ${path} already exists.`,
  );
  return await Confirm.prompt({
    message: "Do you want to overwrite it?",
    default: false,
  });
};

const devcontainerPath = (
  type: pathType = "directory",
  devcontainerName?: string,
) => {
  switch (type) {
    case "file":
      return ".devcontainer.json";

    case "subdirectory":
      if (!devcontainerName) {
        throw new InternalError(
          "In order to create a subdirectory devcontainer, you must provide a devcontainer name",
        );
      }
      return join(".devcontainer", devcontainerName, "devcontainer.json");

    case "directory":
    default:
      return join(".devcontainer", "devcontainer.json");
  }
};

const containerImage = (_engines: string[]) => {
  // Always use our base image. If we get more sophisticated
  // about images, we can add sophistication here
  return kRootDevContainerImage;
};
