/*
* extension-shared.ts
*
* Copyright (C) 2020 by RStudio, PBC
*
*/
import SemVer, { Range } from "semver/mod.ts";
import { Metadata, QuartoFilter } from "../config/types.ts";
import { RevealPluginBundle } from "../format/reveal/format-reveal-plugin.ts";
import { ProjectConfig } from "../project/types.ts";

export const kCommon = "common";
export const kExtensionDir = "_extensions";

export const kTitle = "title";
export const kAuthor = "author";
export const kVersion = "version";
export const kQuartoRequired = "quarto-required";

export const kRevealJSPlugins = "revealjs-plugins";

export type Contributes =
  | "shortcodes"
  | "filters"
  | "formats"
  | "project"
  | "revealjs-plugins";

// TODO: Allow revealjs-plugins to be a list of plugin ymls basically
export interface Extension extends Record<string, unknown> {
  id: ExtensionId;
  title: string;
  author: string;
  version?: SemVer;
  quartoVersion?: Range;
  path: string;
  contributes: {
    project?: Record<string, unknown>;
    shortcodes?: string[];
    filters?: QuartoFilter[];
    formats?: Record<string, unknown>;
    [kRevealJSPlugins]?: Array<string | RevealPluginBundle>;
  };
}

export interface ExtensionContext {
  extensions(
    input: string,
    config?: ProjectConfig,
    projectDir?: string,
  ): Promise<Extension[]>;
  extension(
    name: string,
    input: string,
    config?: ProjectConfig,
    projectDir?: string,
  ): Promise<Extension | undefined>;
  find(
    name: string,
    input: string,
    contributes?:
      | "shortcodes"
      | "filters"
      | "formats"
      | "project"
      | "revealjs-plugins",
    config?: ProjectConfig,
    projectDir?: string,
  ): Promise<Extension[]>;
}

export interface ExtensionId {
  name: string;
  organization?: string;
}

export interface ExtensionMetadata {
  path: string;
  metadata: Metadata;
}

export function extensionIdString(extensionId: ExtensionId) {
  if (extensionId.organization) {
    return `${extensionId.organization}/${extensionId.name}`;
  } else {
    return extensionId.name;
  }
}
