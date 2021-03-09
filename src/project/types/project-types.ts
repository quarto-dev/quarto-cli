/*
* project-types.ts
*
* Copyright (C) 2020 by RStudio, PBC
*
*/

import { Format, FormatExtras } from "../../config/format.ts";
import { ProjectContext, ProjectMetadata } from "../project-context.ts";

import { bookProjectType } from "./project-book.ts";
import { defaultProjectType } from "./project-default.ts";
import { websiteProjectType } from "./website/website.ts";

export interface ProjectType {
  type: string;
  create: (title: string) => ProjectCreate;
  libDir?: string;
  outputDir?: string;
  formatExtras?: (
    context: ProjectContext,
    format: Format,
  ) => FormatExtras;
  metadataFields?: () => string[];
  preRender?: (context: ProjectContext) => Promise<void>;
  postRender?: (context: ProjectContext) => Promise<void>;
}

export interface ProjectCreate {
  configTemplate: string;
  scaffold?: ProjectScaffoldFile[];
  supporting?: string[];
}

export interface ProjectScaffoldFile {
  name: string;
  content: string;
  title?: string;
}

const kTypes = [
  defaultProjectType,
  websiteProjectType,
  bookProjectType,
];

export function projectTypes(): string[] {
  return kTypes.map((type) => type.type);
}

export function projectType(type = "default"): ProjectType {
  const projectType = kTypes.find((pt) => pt.type === type);
  if (projectType) {
    return projectType;
  } else {
    throw new Error(`Unsuppported project type ${type}`);
  }
}
