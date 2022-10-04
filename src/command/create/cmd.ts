/*
* cmd.ts
*
* Copyright (C) 2020 by RStudio, PBC
*
*/
import { create, nextPrompt } from "./artifacts/project.ts";

import { Command } from "cliffy/command/mod.ts";
import { prompt, Select } from "cliffy/prompt/mod.ts";
import { info } from "log/mod.ts";

export interface CreateOptions {
  dir: string;
  commandOpts: Record<string, unknown>;
}

// JSON stdin?
// If JSON provided, make completely non-interactive (must provide all required)

// Pass variadic args to artifacts to populate options

// TODO: this any is a nightmare
interface Artifact {
  name: string;
  // parseArgs: (args: string[]) => Record<string, unknown>;
  nextPrompt: (options: CreateOptions) => any | undefined;
  create: (options: CreateOptions) => Promise<void>;
}

const kArtifacts: Record<string, Artifact> = {
  "project": {
    name: "Project",
    create: create,
    nextPrompt: nextPrompt,
  },
};

export const createCommand = new Command()
  .name("create")
  .description("Create a Quarto artifact (project, document, or extension)")
  .option("-d, --dir [dir:string]", "Directory in which to create artifact", {
    default: ".",
  })
  .option("--no-prompt", "Do not prompt to confirm actions")
  .arguments("[artifact]")
  .action(
    async (
      options: { dir?: string | true; prompt: boolean },
      artifact?: string,
    ) => {
      // TODO: why can dir be 'true'?
      if (
        options.dir === undefined || options.dir === "." || options.dir === true
      ) {
        options.dir = Deno.cwd();
      }
      const createOptions = {
        dir: options.dir,
        prompt: options.prompt,
        commandOpts: options as Record<string, unknown>,
      };
      delete createOptions.commandOpts.dir;
      delete createOptions.commandOpts.prompt;

      // If no artifact has been provided, resolve that
      if (!artifact && options.prompt) {
        artifact = await selectArtifact();
      }

      const resolvedArtifact = await resolveArtifact(artifact);
      if (resolvedArtifact) {
        // Now that we've resolved the artifact, resolve the prompts
        // for the artifact
        let nextPrompt = resolvedArtifact.nextPrompt(createOptions);
        while (nextPrompt !== undefined) {
          if (nextPrompt) {
            const result = await prompt([nextPrompt]);
            createOptions.commandOpts = {
              ...createOptions.commandOpts,
              ...result,
            };
          }
          nextPrompt = resolvedArtifact.nextPrompt(createOptions);
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
