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

export function parseProjectType(
  projType?: string,
): { type: string; template?: string } {
  if (projType) {
    const parts = projType.split(":");
    return {
      type: parts[0],
      template: parts.length > 1 ? parts[1] : undefined,
    };
  } else {
    return {
      type: "default",
    };
  }
}

export function projectTypes(): string[] {
  return kTypes().map((type) => type.type);
}

export function projectTypeAliases(): string[] {
  return kTypes().flatMap((type) => type.typeAliases || []);
}

export function projectType(type = "default"): ProjectType {
  const projectType = kTypes().find((pt) => pt.type === type);
  if (projectType) {
    return projectType;
  } else {
    throw new Error(`Unsuppported project type ${type}`);
  }
}
