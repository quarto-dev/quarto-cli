/*
* project-types.ts
*
* Copyright (C) 2020-2022 Posit Software, PBC
*
*/
import { ProjectType } from "./types.ts";

const _types: ProjectType[] = [];
export function registerProjectType(projectType: ProjectType) {
  _types.push(projectType);
}

function kTypes() {
  return _types.slice();
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
    throw new Error(`Unsupported project type ${type}`);
  }
}
