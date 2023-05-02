/*
* cmd.ts
*
* Copyright (C) 2020-2022 Posit Software, PBC
*
*/

import { extensionArtifactCreator } from "./artifacts/extension.ts";
import { projectArtifactCreator } from "./artifacts/project.ts";
import { kEditorInfos, scanForEditors } from "./editor.ts";

import { isInteractiveTerminal } from "../../core/platform.ts";
import { runningInCI } from "../../core/ci-info.ts";

import { CreateDirective } from "./artifacts/artifact-shared.ts";

import { Command } from "cliffy/command/mod.ts";
import {
  prompt,
  Select,
  SelectValueOptions,
} from "cliffy/prompt/mod.ts";
import { readLines } from "io/mod.ts";
import { info } from "log/mod.ts";

export interface CreateContext {
  cwd: string;
  options: Record<string, unknown>;
}

export interface CreateResult {
  // Path to the directory or document
  path: string;

  // Files to open
  openfiles: string[];
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
  finalizeOptions: (options: CreateContext) => CreateDirective;

  // As long as prompting is allowed, allow the artifact creator prompting to populate
  // the options. This will be called until it return undefined, at which point
  // the artifact will be created using the options
  // deno-lint-ignore no-explicit-any
  nextPrompt: (options: CreateContext) => any | undefined; // TODO: this any is a nightmare

  // Creates the artifact using the specified options
  // Returns the path to the created artifact
  createArtifact: (
    directive: CreateDirective,
    quiet?: boolean,
  ) => Promise<CreateResult>;

  // Set this to false to exclude this artifact type from the create command
  enabled?: boolean;
}

// The registered artifact creators
const kArtifactCreators: ArtifactCreator[] = [
  projectArtifactCreator,
  extensionArtifactCreator,
  // documentArtifactCreator, CT: Disabled for 1.2 as it arrived too late on the scene
];

export const createCommand = new Command()
  .name("create")
  .description("Create a Quarto project or extension")
  .option(
    "--open [editor:string]",
    `Open new artifact in this editor (${
      kEditorInfos.map((info) => info.id).join(",")
    })`,
  )
  .option("--no-open", "Do not open in an editor")
  .option("--no-prompt", "Do not prompt to confirm actions")
  .option("--json", "Pass serialized creation options via stdin", {
    hidden: true,
  })
  .arguments("[type] [commands...]")
  .action(
    async (
      options: {
        prompt: boolean;
        json?: boolean;
        open?: string | boolean;
      },
      type?: string,
      ...commands: string[]
    ) => {
      if (options.json) {
        await createFromStdin();
      } else {
        // Compute a sane default for prompting
        const isInteractive = isInteractiveTerminal() && !runningInCI();
        const allowPrompt = isInteractive && !!options.prompt && !options.json;

        // Resolve the type into an artifact
        const resolved = await resolveArtifact(
          type,
          options.prompt,
        );
        const resolvedArtifact = resolved.artifact;
        if (resolvedArtifact) {
          // Resolve the arguments that the user provided into options
          // for the artifact provider

          // If we aliased the type, shift the args (including what was
          // the type alias in the list of args for the artifact creator
          // to resolve)
          const args = commands;

          const commandOpts = resolvedArtifact.resolveOptions(args);
          const createOptions = {
            cwd: Deno.cwd(),
            options: commandOpts,
          };

          if (allowPrompt) {
            // Prompt the user until the options have been fully realized
            let nextPrompt = resolvedArtifact.nextPrompt(createOptions);
            while (nextPrompt !== undefined) {
              if (nextPrompt) {
                const result = await prompt([nextPrompt]);
                createOptions.options = {
                  ...createOptions.options,
                  ...result,
                };
              }
              nextPrompt = resolvedArtifact.nextPrompt(createOptions);
            }
          }

          // Complete the defaults
          const createDirective = resolvedArtifact.finalizeOptions(
            createOptions,
          );

          // Create the artifact using the options
          const createResult = await resolvedArtifact.createArtifact(
            createDirective,
          );

          // Now that the article was created, offer to open the item
          if (allowPrompt && options.open !== false) {
            const resolvedEditor = await resolveEditor(
              createResult,
              typeof (options.open) === "string" ? options.open : undefined,
            );
            if (resolvedEditor) {
              resolvedEditor.open();
            }
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
  return {
    artifact,
  };
};


// Wrapper that will provide keyboard selection hint (if necessary)
async function promptSelect(
  message: string,
  options: SelectValueOptions,
) {
  return await Select.prompt({
    message,
    options,
  });
}

// Prompts from the type of artifact to create
const promptForType = async () => {
  return await promptSelect(
    "Create",
    kArtifactCreators.map((artifact) => {
      return {
        name: artifact.displayName.toLowerCase(),
        value: artifact.type,
      };
    }),
  );
};

// Determine the selected editor that should be used to open
// the artifact once created
const resolveEditor = async (createResult: CreateResult, editor?: string) => {
  // Find supported editors
  const editors = await scanForEditors(kEditorInfos, createResult);

  const defaultEditor = editors.find((ed) => {
    return ed.id === editor;
  });
  if (defaultEditor) {
    // If an editor is specified, use that
    return defaultEditor;
  } else {
    // See if we are executing inside of an editor, and just use
    // that editor
    const inEditor = editors.find((ed) => ed.inEditor);
    if (inEditor) {
      return inEditor;
    } else if (editors.length > 0) {
      // Prompt the user to select an editor
      const editorOptions = editors.map((editor) => {
        return {
          name: editor.name.toLowerCase(),
          value: editor.name,
        };
      });

      // Add an option to not open
      const options = [...editorOptions, {
        name: "(don't open)",
        value: "do not open",
      }];
      const name = await promptSelect("Open With", options);

      // Return the matching editor (if any)
      const selectedEditor = editors.find((edit) => edit.name === name);
      return selectedEditor;
    } else {
      return undefined;
    }
  }
};

async function createFromStdin() {
  /* Read a single line (should be json) like:
  {
    type: "project",
    directive: {
      "directory" : "",
      "template" : "",
      "name": ""
    }
  }
  */

  // Read the stdin and then close it
  const { value: input } = await readLines(Deno.stdin).next();
  Deno.stdin.close();

  // Parse options
  const jsonOptions = JSON.parse(input);

  // A type is required in the JSON no matter what
  const type = jsonOptions.type;
  if (!type) {
    throw new Error(
      "The provided json for create artifacts must include a valid type",
    );
  }

  // Validate other required fields
  if (
    !jsonOptions.directive || !jsonOptions.directive.name ||
    !jsonOptions.directive.directory || !jsonOptions.directive.template
  ) {
    throw new Error(
      "The provided json for create artifacts must include a directive with a name, directory, and template.",
    );
  }

  // Find the artifact creator
  const resolved = await resolveArtifact(
    type,
    false,
  );
  const createDirective = jsonOptions.directive as CreateDirective;

  // Create the artifact using the options
  const createResult = await resolved.artifact.createArtifact(
    createDirective,
    true,
  );
  const resultJSON = JSON.stringify(createResult, undefined);
  Deno.stdout.writeSync(new TextEncoder().encode(resultJSON));
}
