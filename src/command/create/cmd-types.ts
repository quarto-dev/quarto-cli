/*
 * cmd-types.ts
 *
 * Copyright (C) 2020-2023 Posit Software, PBC
 */

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

export interface CreateDirective {
  displayType: string;
  name: string;
  directory: string;
  template: string;
  options: Record<string, unknown>;
}

export interface CreateDirectiveData extends Record<string, string> {
  name: string;
  filesafename: string;
  classname: string;
  title: string;
  author: string;
  version: string;
  quartoversion: string;
}
