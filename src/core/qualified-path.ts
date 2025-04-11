/*
 * qualified-path.ts
 *
 * Path objects that hold additional information about their status
 *
 * Copyright (C) 2022 Posit Software, PBC
 */

import {
  AbsolutePath,
  ProjectRelativePath,
  QualifiedPath,
  RelativePath,
} from "../config/types.ts";
import { join } from "../deno_ral/path.ts";
import { UnreachableError } from "./lib/error.ts";

export class InvalidPathError extends Error {
  constructor(msg: string) {
    super(msg);
  }
}

export type PathInfo = {
  projectRoot: string;
  currentFileDir: string;
};

export const asRawPath = (path: QualifiedPath, info: PathInfo): string => {
  switch (path.type) {
    case "absolute":
      return path.path;
    case "relative":
      return join(info.currentFileDir, path.path);
    case "project-relative":
      return join(info.projectRoot, path.path);
    default:
      throw new UnreachableError();
  }
};

export function makePath(
  path: string,
  forceAbsolute?: boolean,
): QualifiedPath {
  const type = path.startsWith("/")
    ? (forceAbsolute ? "absolute" : "project-relative")
    : "relative";

  const result: QualifiedPath = {
    path: path,
    type,
  };

  return result;
}

export function isRelativePath(path: QualifiedPath): path is RelativePath {
  return path.type === "relative";
}

export function isProjectRelativePath(
  path: QualifiedPath,
): path is ProjectRelativePath {
  return path.type === "project-relative";
}

export function isAbsolutePath(path: QualifiedPath): path is AbsolutePath {
  return path.type === "absolute";
}
