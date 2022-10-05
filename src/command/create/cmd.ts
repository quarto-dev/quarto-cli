/*
* cmd.ts
*
* Copyright (C) 2020 by RStudio, PBC
*
*/
import { projectArtifactCreator } from "./artifacts/project.ts";

import { Command } from "cliffy/command/mod.ts";
import { prompt, Select } from "cliffy/prompt/mod.ts";
import { info } from "log/mod.ts";

// JSON stdin?
// If JSON provided, make completely non-interactive (must provide all required)

export interface CreateOptions {
  dir: string;
  commandOpts: Record<string, unknown>;
}

export interface ArtifactCreator {
  displayName: string;
  type: string;
  resolveOptions: (args: string[]) => Record<string, unknown>;
  resolveDefaults: (options: CreateOptions) => void;
  nextPrompt: (options: CreateOptions) => any | undefined; // TODO: this any is a nightmare
  createArtifact: (options: CreateOptions) => Promise<void>;
  enabled?: boolean;
}

const kArtifactCreators: ArtifactCreator[] = [
  projectArtifactCreator,
];

export const createCommand = new Command()
  .name("create")
  .description("Create a Quarto artifact (project, document, or extension)")
  .option("-d, --dir [dir:string]", "Directory in which to create artifact", {
    default: ".",
  })
  .option("--no-prompt", "Do not prompt to confirm actions")
  .arguments("[type] [commands...]")
  .action(
    async (
      options: { dir?: string | true; prompt: boolean },
      type?: string,
      commands?: string[],
    ) => {
      // TODO: why can dir be 'true'?
      if (
        options.dir === undefined ||
        options.dir === "." ||
        options.dir === true
      ) {
        options.dir = Deno.cwd();
      }

      // Resolve the type into an artifact
      const resolvedArtifact = await resolveArtifact(type, options.prompt);

      if (resolvedArtifact) {
        // Resolve the argumenst that the user provided into options
        // for the artifact provider
        const commandOpts = commands
          ? resolvedArtifact.resolveOptions(commands)
          : {};
        const createOptions = {
          dir: options.dir,
          commandOpts,
        };

        if (options.prompt) {
          // Prompt the user until the options have been fully realized
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
        } else {
          resolvedArtifact.resolveDefaults(createOptions);
        }

        // Create the artifact using the options
        await resolvedArtifact.createArtifact(createOptions);
      }
    },
  );

// Resolves the artifact string (or undefined) into an
// Artifact interface which will provide the functions
// needed to complete the creation
const resolveArtifact = async (type?: string, prompt?: boolean) => {
  // Finds an artifact
  const findArtifact = (type: string) => {
    return kArtifactCreators.find((artifact) =>
      artifact.type === type && artifact.enabled !== false
    );
  };

  // Use the provided type to search (or prompt the user)
  let artifact = type ? findArtifact(type) : undefined;
  while (artifact === undefined) {
    if (!prompt) {
      // We can't prompt to resolve this, so just throw an Error
      throw new Error(`Failed to create ${type} - the type isn't recognized`);
    }

    if (type) {
      // The user provided a type, but it isn't recognized
      info(`Unknown type ${type} - please select from the following:`);
    }

    // Prompt the user to select a type
    type = await promptForType();

    // Find the type (this should always work since we provided the id)
    artifact = findArtifact(type);
  }
  return artifact;
};

const promptForType = async () => {
  return await Select.prompt({
    message: "Select type",
    options: kArtifactCreators.map((artifact) => {
      return {
        name: artifact.displayName,
        value: artifact.type,
      };
    }),
  });
};
