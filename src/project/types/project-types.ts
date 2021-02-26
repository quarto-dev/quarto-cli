/*
* project-types.ts
*
* Copyright (C) 2020 by RStudio, PBC
*
*/

import { FormatPandoc } from "../../config/format.ts";
import { Metadata } from "../../config/metadata.ts";
import { ProjectContext, ProjectMetadata } from "../project-context.ts";

import { bookProjectType } from "./project-book.ts";
import { defaultProjectType } from "./project-default.ts";
import { websiteProjectType } from "./project-website.ts";

export interface ProjectType {
  type: string;
  create: (title: string, outputDir?: string) => ProjectCreate;
  config: (config?: ProjectMetadata) => ProjectMetadata | undefined;
  preRender?: (context: ProjectContext) => { pandoc: FormatPandoc };
  postRender?: (context: ProjectContext) => void;
}

export interface ProjectCreate {
  metadata?: Metadata;
  scaffold?: ProjectScaffoldFile[];
  supporting?: string[];
}

export interface ProjectScaffoldFile {
  name: string;
  content: string;
  title?: string;
}

export function projectType(type = "default"): ProjectType {
  const types = [
    defaultProjectType,
    websiteProjectType,
    bookProjectType,
  ];
  const projectType = types.find((pt) => pt.type === type);
  if (projectType) {
    return projectType;
  } else {
    throw new Error(`Unsuppported project type ${type}`);
  }
}
