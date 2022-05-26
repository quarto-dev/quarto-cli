/*
* extension-shared.ts
*
* Copyright (C) 2020 by RStudio, PBC
*
*/
import SemVer from "semver/mod.ts";
import { Metadata } from "../config/types.ts";
import { ProjectContext } from "../project/types.ts";

export const kContributes = "contributes";
export const kCommon = "common";
export const kExtensionDir = "_extensions";

export const kTitle = "title";
export const kAuthor = "author";
export const kVersion = "version";

export interface Extension extends Record<string, unknown> {
  id: ExtensionId;
  title: string;
  author: string;
  version?: SemVer;
  path: string;
  [kContributes]: {
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
}

export interface ExtensionId {
  name: string;
  organization?: string;
}

export interface ExtensionVersion {
  major: number;
  minor: number;
  revision: number;
  build: number;
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
