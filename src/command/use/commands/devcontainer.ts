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
  InspectedDocumentConfig,
  InspectedProjectConfig,
  isProjectConfig,
} from "../../../quarto-core/inspect.ts";
import { InternalError } from "../../../core/lib/error.ts";

import { extname, join } from "path/mod.ts";
import { ensureDirSync, existsSync } from "fs/mod.ts";
import { dirname } from "path/mod.ts";
import { Table } from "cliffy/table/mod.ts";
import { Confirm, Input } from "cliffy/prompt/mod.ts";
import * as ld from "../../../core/lodash.ts";
import { projectContext } from "../../../project/project-context.ts";
import { projectType } from "../../../project/types/project-types.ts";
import {
  kManuscriptType,
  ResolvedManuscriptConfig,
} from "../../../project/types/manuscript/manuscript-types.ts";
import { renderFormats } from "../../render/render-contexts.ts";
import { isPdfOutput } from "../../../config/format.ts";

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

const kDefaultContainerTitle = "Default Container";

interface DevContainer {
  name: string;
  image: string;
  customizations?: {
    vscode?: {
      extensions?: string[];
    };
  };
  features?: Record<string, Record<string, unknown>>;
  postCreateCommand?: string;
  postAttachCommand?: string;
  forwardPorts?: number[];
  portsAttributes?: Record<string, PortAttribute>;
}

interface PortAttribute {
  label: string;
  requireLocalPort: boolean;
  onAutoForward: string;
}

interface ContainerContext {
  title?: string;
  tools: Array<"tinytex" | "chromium">;
  codeEnvironment: "vscode" | "rstudio" | "jupyterlab";
  engines: string[];
  quarto: "release" | "prerelease";
}

// The devcontainer can be ina  file, directory, or a subdirectory (where multiple subdirectories
// could be used to provide the user with a choice of dev containers)
type pathType = "file" | "directory" | "subdirectory";

// The current global image that we use for the devcontainer
const kBaseContainerImage = "mcr.microsoft.com/devcontainers/base:ubuntu";

// Regex used to determine whether file contents will require the installation of Chromium
const kChromiumHint = /````*{mermaid}|{dot}/gm;

// Options
// name - the name of the devcontainer

// Scan inputs for languages
// if R / qmd
// if python / ipynb
// if other QMD

// if knitr, default to rstudio
// if jupyter, look for qmds vs ipynb
// for general projects, count:
// if qmd, then vscode
// if ipynb, then jupyterlab
// for manuscripts:
// if article is qmd, vscode
// if article is ipynb, jupyterlab

// only install tinytex if pdf is present

// dont' install chromium unless mermaid or graphviz is present

// use rocker images with features to customize

// knitr - rocker base images
// jupyter, use standard with python composed
//  ipynb vs qmd for tooling

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
      // Note: this will throw if this isn't a project, which is expected
      // and desirable
      info("Inspecting configuration");
      const config = await inspectConfig(Deno.cwd());

      info("Scanning project");
      if (!isProjectConfig(config)) {
        throw new InternalError(
          "The quarto use devcontainer command expects to be run in a Quarto project",
        );
      }
      const projectConfig = config as InspectedProjectConfig;
      const containerCtx = await resolveContainerContext(
        projectConfig,
        "prerelease",
      );

      // Confirm the container title
      const userTitle = await confirmTitle(
        containerCtx.title || kDefaultContainerTitle,
      );

      // The devcontainer JSON that we are building
      const devcontainer: DevContainer = {
        name: userTitle,
        image: containerImage(containerCtx),
        features: resolveFeatures(containerCtx),
      };

      // Compute the depdendencies to restore
      const postCreateCommand = await postCreate();
      if (postCreateCommand) {
        devcontainer.postCreateCommand = postCreateCommand;
      }

      // Compute the post attach command (if any)
      const postAttachCommand = await postAttach(containerCtx);
      if (postAttachCommand) {
        devcontainer.postAttachCommand = postAttachCommand;
      }

      const portInfo = await portAttributes(containerCtx);
      if (portInfo) {
        // Forward ports
        devcontainer.forwardPorts = devcontainer.forwardPorts || [];
        const portNumbers = Object.keys(portInfo).map(parseInt);
        devcontainer.forwardPorts.push(...portNumbers);

        // Forward port attributes
        devcontainer.portsAttributes = devcontainer.portsAttributes || {};
        for (const port of Object.keys(portInfo)) {
          devcontainer.portsAttributes[port] = portInfo[port];
        }
      }

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

const resolveContainerContext = async (
  config: InspectedProjectConfig,
  quarto: "release" | "prerelease",
) => {
  const containerCtx: ContainerContext = {
    engines: config.engines,
    tools: [],
    codeEnvironment: "vscode",
    quarto,
  };

  const qmdCodeTool = config.engines.includes("knitr") ? "rstudio" : "vscode";
  const ipynbCodeTool = "jupyterlab";

  // The project inspected configuration
  const projectConfig = config as InspectedProjectConfig;

  // Determine the code environment
  // Special case manuscripts - the root article will drive the code environment
  if (projectType(config.config.project.type).type === kManuscriptType) {
    // Choose the code environment based upon the engine and article file type
    const manuscriptConfig = config.config
      ?.[kManuscriptType] as ResolvedManuscriptConfig;
    if (extname(manuscriptConfig.article) === ".qmd") {
      containerCtx.codeEnvironment = qmdCodeTool;
    } else {
      containerCtx.codeEnvironment = ipynbCodeTool;
    }
  } else {
    // Count the ipynb vs qmds and use that as guideline
    const exts: Record<string, number> = {};
    const inputs = projectConfig.files.input;
    for (const input of inputs) {
      const ext = extname(input);
      exts[ext] = (exts[ext] || 0) + 1;
    }

    const qmdCount = exts[".qmd"] || 0;
    const ipynbCount = exts[".ipynb"] || 0;
    if (qmdCount >= ipynbCount) {
      containerCtx.codeEnvironment = qmdCodeTool;
    } else {
      containerCtx.codeEnvironment = ipynbCodeTool;
    }
  }

  // Determine the title
  const title = projectConfig.config.project.title;
  containerCtx.title = title;

  // Determine what tools (if any) we should also install
  let tinytex = false;
  let chromium = false;
  for (const input of projectConfig.files.input) {
    if (!tinytex) {
      // If we haven't yet found the need for tinytex,
      // go ahead and look for PDF format. Once a single
      // file needs, it we can stop looking
      const formats = renderFormats(input);
      const fmtStrs = Object.keys(formats);
      const hasPdf = fmtStrs.some((fmtStr) => {
        return isPdfOutput(fmtStr);
      });
      tinytex = hasPdf;
    }

    // See if the file contains mermaid or graphviZ
    if (!chromium) {
      const contents = Deno.readTextFileSync(input);
      if (contents.match(kChromiumHint)) {
        chromium = true;
      }
    }

    if (tinytex && chromium) {
      break;
    }
  }

  if (tinytex) {
    containerCtx.tools.push("tinytex");
  }

  if (chromium) {
    containerCtx.tools.push("chromium");
  }

  return containerCtx;
};

const resolveFeatures = (ctx: ContainerContext) => {
  const features: Record<string, Record<string, unknown>> = {};
  if (ctx.engines.includes("knitr")) {
    features["ghcr.io/rocker-org/devcontainer-features/r-apt:0"] = {
      vscodeRSupport: ctx.codeEnvironment === "vscode",
      installRMarkdown: true,
      installJupyterlab: ctx.engines.includes("jupyter"),
    };
  } else if (ctx.engines.includes("python")) {
    features["ghcr.io/devcontainers/features/python:1"] = {
      installJupyterlab: ctx.codeEnvironment === "jupyterlab",
    };
  }

  // Add Quarto
  features["ghcr.io/rocker-org/devcontainer-features/quarto-cli:1"] = {
    version: ctx.quarto,
    installTinyTex: ctx.tools.includes("tinytex"),
    installChromium: ctx.tools.includes("chromium"),
  };
  return features;
};

const confirmChanges = async (devContainer: DevContainer) => {
  const rows: string[][] = [];
  const indent = "  ";
  rows.push([indent, "Name:", devContainer.name]);
  rows.push([indent, "Docker Image:", devContainer.image]);
  if (devContainer.postCreateCommand) {
    rows.push([indent, "Dependencies:", devContainer.postCreateCommand]);
  }

  const table = new Table(...rows);
  info(
    `\nA development container with the following options will be created:\n\n${table.toString()}\n`,
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

const confirmTitle = async (title: string) => {
  info("Container name:");
  return await Input.prompt({ message: "Container name:", default: title });
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

const containerImage = (_containerCtx: ContainerContext) => {
  // Always use our base image. If we get more sophisticated
  // about images, we can add sophistication here
  return kBaseContainerImage;
};

const postCreate = async () => {
  const command: string[] = [];
  const envFiles = Object.keys(environmentCommands);
  for (const envFile of envFiles) {
    if (existsSync(envFile)) {
      command.push(environmentCommands[envFile]);
    }
  }
  if (command.length > 0) {
    return command.join(" && ");
  }
};

const postAttach = async (ctx: ContainerContext) => {
  const postAttachCmd: string[] = [];
  if (ctx.codeEnvironment === "rstudio") {
    postAttachCmd.push("sudo rstudio-server start");
  }
  return postAttachCmd.join("\n");
};

const portAttributes = async (ctx: ContainerContext) => {
  return kPortAttr[ctx.codeEnvironment];
};

const environmentCommands: Record<string, string> = {
  "renv.lock": `RScript -e "renv::restore()"`,
  "requirements.txt": `python3 -m pip3 install -r requirements.txt`,
};

const kPortAttr: Record<string, Record<string, PortAttribute>> = {
  "rstudio": {
    "8787": {
      "label": "Rstudio",
      "requireLocalPort": true,
      "onAutoForward": "ignore",
    },
  },
  "jupyterlab": {
    "8888": {
      "label": "Jupyter",
      "requireLocalPort": true,
      "onAutoForward": "ignore",
    },
  },
};

// If no environment detected, use langugage to determine a URL to a page on our docs that describes what to do
// If no environment prsent, throw error
