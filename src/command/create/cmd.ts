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
import { isInteractiveTerminal } from "../../core/platform.ts";
import { runningInCI } from "../../core/ci-info.ts";
import { execProcess } from "../../core/process.ts";
import { kEditorScanners, scanForEditors } from "./editor.ts";

// TODO: JSON stdin?
// If JSON provided, make completely non-interactive (must provide all required)
export interface CreateOptions {
  dir: string;
  commandOpts: Record<string, unknown>;
}

export interface ArtifactCreator {
  // The name that is displayed to users
  displayName: string;

  // The identifier for this artifact type
  type: string;

  // artifact creators are passed any leftover args from the create command
  // and may use those arguments to populate the options
  resolveOptions: (args: string[]) => Record<string, unknown>;

  // this will always be called, giving the artifact creator
  // a change to finalize / transform options
  finalizeOptions: (options: CreateOptions) => void;

  // As long as prompting is allowed, allow the artifact creator prompting to populate
  // the options. This will be called until it return undefined, at which point
  // the artifact will be created using the options
  // deno-lint-ignore no-explicit-any
  nextPrompt: (options: CreateOptions) => any | undefined; // TODO: this any is a nightmare

  // Creates the artifact using the specified options
  // Returns the path to the created artifact
  createArtifact: (options: CreateOptions) => Promise<string>;

  // Set this to false to exclude this artifact type from the create command
  enabled?: boolean;
}

// The registered artifact creators
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

      // Compute a sane default for prompting
      const allowPrompt = !!options.prompt ||
        isInteractiveTerminal() && !runningInCI();

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

        if (allowPrompt) {
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
        }

        // Complete the defaults
        resolvedArtifact.finalizeOptions(createOptions);

        // Create the artifact using the options
        const artifactPath = await resolvedArtifact.createArtifact(
          createOptions,
        );

        // Now that the article was created, offer to open the item
        if (allowPrompt) {
          const editor = await promptForEditor(artifactPath);
          if (editor) {
            console.log(editor);
            execProcess({
              cmd: editor.cmd,
              cwd: editor.cwd,
            });
          }
        }
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
      if (type) {
        throw new Error(`Failed to create ${type} - the type isn't recognized`);
      } else {
        throw new Error(
          `Creation failed - you must provide a type to create when using '--no-prompt'`,
        );
      }
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
    message: "Create",
    options: kArtifactCreators.map((artifact) => {
      return {
        name: artifact.displayName.toLowerCase(),
        value: artifact.type,
      };
    }),
  });
};

const promptForEditor = async (artifactPath: string) => {
  const editors = await scanForEditors(kEditorScanners, artifactPath);
  const editorOptions = editors.map((editor) => {
    return {
      name: editor.name.toLowerCase(),
      value: editor.name,
    };
  });

  // Add an option to not open
  const options = [...editorOptions, {
    name: "do not open",
    value: "do not open",
  }];

  const name = await Select.prompt({
    message: "Open with",
    options: options,
  });

  const editor = editors.find((edit) => edit.name === name);
  return editor;
};
