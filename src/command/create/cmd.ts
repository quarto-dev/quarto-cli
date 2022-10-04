/*
* cmd.ts
*
* Copyright (C) 2020 by RStudio, PBC
*
*/
import { create, prompts } from "./artifacts/project.ts";

import { Command } from "cliffy/command/mod.ts";
import { Confirm, ConfirmOptions, prompt, Select } from "cliffy/prompt/mod.ts";
import { info } from "log/mod.ts";

export interface CreateOptions {
  dir: string;
  commandOpts: Record<string, unknown>;
}

interface Artifact {
  name: string;
  prompts: (options: CreateOptions) => Array<ConfirmOptions>;
  create: (options: CreateOptions) => Promise<void>;
}

const kArtifacts: Record<string, Artifact> = {
  "project": {
    name: "Project",
    create: create,
    prompts: prompts,
  },
};

export const createCommand = new Command()
  .name("create")
  .description("Create a Quarto artifact (project, document, or extension)")
  .option("-d, --dir [dir:string]", "Directory in which to create artifact", {
    default: ".",
  })
  .arguments("[artifact]")
  .action(
    async (options: { dir?: string | true }, artifact?: string) => {
      // TODO: why can dir be 'true'?
      if (
        options.dir === undefined || options.dir === "." || options.dir === true
      ) {
        options.dir = Deno.cwd();
      }
      const createOptions = {
        dir: options.dir,
        commandOpts: options as Record<string, unknown>,
      };
      delete createOptions.commandOpts.dir;

      // If no artifact has been provided, resolve that
      if (!artifact) {
        artifact = await selectArtifact();
      }

      const resolvedArtifact = await resolveArtifact(artifact);
      if (resolvedArtifact) {
        // Now that we've resolved the artifact, resolve the prompts
        // for the artifact
        const confirmOptions = resolvedArtifact.prompts(createOptions);
        if (confirmOptions.length > 0) {
          // TODO: The type system here is driving me f'ing insane
          const result = await prompt(confirmOptions as any);
          createOptions.commandOpts = {
            ...createOptions.commandOpts,
            ...result,
          };
          console.log(createOptions);
        }

        await resolvedArtifact.create(createOptions);
      }
    },
  );

// Resolves the artifact string (or undefined) into an
// Artifact interface which will provide the functions
// needed to complete the creation
const resolveArtifact = async (artifact?: string) => {
  artifact = artifact?.toLowerCase();
  if (artifact && kArtifacts[artifact]) {
    return kArtifacts[artifact];
  } else if (artifact) {
    // Unrecognized - prompt or error
    info(`Unknown type ${artifact} - please select from the following:`);
    const selected = await selectArtifact();
    return kArtifacts[selected];
  } else {
    // Not provided, prompt
    const selected = await selectArtifact();
    return kArtifacts[selected];
  }
};

// Provides a selection list of the artifacts that can
// be created
async function selectArtifact() {
  const result = await Select.prompt({
    message: "Select what you'd like to create",
    options: Object.keys(kArtifacts).map((key) => {
      const artifact = kArtifacts[key];
      return {
        name: artifact.name,
        value: key,
      };
    }),
  });

  return result;
}
