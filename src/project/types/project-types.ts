/*
* project-types.ts
*
* Copyright (C) 2020 by RStudio, PBC
*
*/

import { bookProjectType } from "./book/book.ts";
import { defaultProjectType } from "./project-default.ts";
import { ProjectType } from "./project-type.ts";
import { websiteProjectType } from "./website/website.ts";

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
