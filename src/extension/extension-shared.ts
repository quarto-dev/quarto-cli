/*
* extension-shared.ts
*
* Copyright (C) 2020 by RStudio, PBC
*
*/
import SemVer from "semver/mod.ts";
import { Metadata } from "../config/types.ts";
import { ProjectContext } from "../project/types.ts";

export const kCommon = "common";
export const kExtensionDir = "_extensions";

export const kTitle = "title";
export const kAuthor = "author";
export const kVersion = "version";

// TODO: rename format => formats
export interface Extension extends Record<string, unknown> {
  id: ExtensionId;
  title: string;
  author: string;
  version?: SemVer;
  path: string;
  contributes: {
    shortcodes?: string[];
    filters?: string[];
    format?: Record<string, unknown>;
  };
}

export interface ExtensionContext {
  extensions(
    input: string,
    project?: ProjectContext,
  ): Extension[];
  extension(
    name: string,
    input: string,
    project?: ProjectContext,
  ): Extension | undefined;
  find(
    name: string,
    input: string,
    contributes: "shortcodes" | "filters" | "format",
    project?: ProjectContext,
  ): Extension | undefined;
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
    return `${extensionId.name}@${extensionId.organization}`;
  } else {
    return extensionId.name;
  }
}
