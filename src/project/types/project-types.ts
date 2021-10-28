/*
* project-types.ts
*
* Copyright (C) 2020 by RStudio, PBC
*
*/
import { ProjectType } from "./types.ts";

import { bookProjectType } from "./book/book.ts";
import { defaultProjectType } from "./project-default.ts";
import { websiteProjectType } from "./website/website.ts";

function kTypes() {
  return [
    defaultProjectType,
    websiteProjectType,
    bookProjectType,
  ];
}

export function projectTypes(): string[] {
  return kTypes().map((type) => type.type);
}

export function projectTypeAliases(): string[] {
  return kTypes().flatMap((type) => type.typeAliases || []);
}

export function projectType(type = "default"): ProjectType {
  const projectType = kTypes().find((pt) => pt.type === type || pt.typeAliases?.includes(type));
  if (projectType) {
    return projectType;
  } else {
    throw new Error(`Unsuppported project type ${type}`);
  }
}
