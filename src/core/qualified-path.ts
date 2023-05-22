/*
 * qualified-path.ts
 *
 * Path objects that hold additional information about their status
 *
 * Copyright (C) 2022 Posit Software, PBC
 */

import { join, relative, resolve } from "path/mod.ts";
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

export type PathType = "project-relative" | "relative" | "absolute";

type BasePath = {
  value: string;
  asAbsolute: (info?: PathInfo) => AbsolutePath;
  asRelative: (info?: PathInfo) => RelativePath;
  asProjectRelative: (info?: PathInfo) => ProjectRelativePath;
};

export type QualifiedPath = BasePath & { type?: PathType };
export type AbsolutePath = BasePath & { type: "absolute" };
export type RelativePath = BasePath & { type: "relative" };
export type ProjectRelativePath = BasePath & { type: "project-relative" };

export function makePath(
  path: string,
  info?: PathInfo,
  forceAbsolute?: boolean,
): QualifiedPath {
  const type = path.startsWith("/")
    ? (forceAbsolute ? "absolute" : "project-relative")
    : "relative";

  const result: QualifiedPath = {
    value: path,
    type,
    asAbsolute(info?: PathInfo) {
      return toAbsolutePath(this, info);
    },
    asRelative(info?: PathInfo) {
      return toRelativePath(this, info);
    },
    asProjectRelative(info?: PathInfo) {
      return toProjectRelativePath(this, info);
    },
  };

  // we call asAbsolute() at least once on each path so
  // that the path is validated; this is simply
  // so that exceptions can be raised appropriately.
  const quartoPaths: PathInfo = resolvePathInfo(info);
  result.asAbsolute(quartoPaths);

  return result;
}

export function readTextFile(t: QualifiedPath, options?: Deno.ReadFileOptions) {
  return Deno.readTextFile(t.asAbsolute().value, options);
}

export function readTextFileSync(
  t: QualifiedPath,
) {
  return Deno.readTextFileSync(t.asAbsolute().value);
}

// validates an absolute path
function validate(value: string, quartoPaths: PathInfo): string {
  if (!value.startsWith(quartoPaths.projectRoot)) {
    throw new InvalidPathError(
      "Paths cannot resolve outside of document or project root",
    );
  }
  return value;
}

function toAbsolutePath(
  path: QualifiedPath,
  info?: PathInfo,
): AbsolutePath {
  let value: string;

  if (isAbsolutePath(path)) {
    return path;
  }

  const quartoPaths: PathInfo = resolvePathInfo(info);

  switch (path.type) {
    case "project-relative":
      // project-relative -> absolute
      value = resolve(join(quartoPaths.projectRoot, path.value));
      break;
    case "relative":
      // relative -> absolute
      value = resolve(join(quartoPaths.currentFileDir, path.value));
      break;
    default:
      if (path.value.startsWith("/")) {
        // project-relative -> absolute
        value = resolve(join(quartoPaths.projectRoot, path.value));
      } else {
        // relative -> absolute
        value = resolve(join(quartoPaths.currentFileDir, path.value));
      }
  }
  value = validate(value, quartoPaths);

  return {
    value,
    type: "absolute",
    asAbsolute(_info?: PathInfo) {
      return this;
    },
    asRelative(info?: PathInfo) {
      return toRelativePath(this, info);
    },
    asProjectRelative(info?: PathInfo) {
      return toProjectRelativePath(this, info);
    },
  };
}

function toRelativePath(
  path: QualifiedPath,
  info?: PathInfo,
): RelativePath {
  let value: string;

  if (isRelativePath(path)) {
    return path;
  }

  const quartoPaths: PathInfo = resolvePathInfo(info);

  switch (path.type) {
    case "absolute":
      // absolute -> relative
      value = relative(quartoPaths.currentFileDir, path.value);
      break;
    case "project-relative": {
      // project-relative -> absolute -> relative
      const absPath = validate(
        resolve(join(quartoPaths.projectRoot, path.value)),
        quartoPaths,
      );
      value = relative(
        quartoPaths.currentFileDir,
        absPath,
      );
      break;
    }
    default:
      if (path.value.startsWith("/")) {
        // project-relative -> absolute -> relative
        const absPath = validate(
          resolve(join(quartoPaths.projectRoot, path.value)),
          quartoPaths,
        );
        value = relative(
          quartoPaths.currentFileDir,
          absPath,
        );
      } else {
        throw new UnreachableError();
      }
  }

  return {
    value,
    type: "relative",
    asAbsolute(info?: PathInfo) {
      return toAbsolutePath(this, info);
    },
    asRelative(_info?: PathInfo) {
      return this;
    },
    asProjectRelative(info?: PathInfo) {
      return toProjectRelativePath(this, info);
    },
  };
}

function toProjectRelativePath(
  path: QualifiedPath,
  info?: PathInfo,
): ProjectRelativePath {
  let value: string;

  if (isProjectRelativePath(path)) {
    return path;
  }

  const quartoPaths: PathInfo = resolvePathInfo(info);

  switch (path.type) {
    case "absolute":
      // absolute -> project-relative
      value = `/${relative(quartoPaths.projectRoot, path.value)}`;
      break;
    case "relative":
      // relative -> absolute -> project-relative
      value = `/${
        relative(
          quartoPaths.projectRoot,
          validate(
            resolve(join(quartoPaths.currentFileDir, path.value)),
            quartoPaths,
          ),
        )
      }`;
      break;
    default:
      if (!path.value.startsWith("/")) {
        throw new UnreachableError();
      } else {
        // relative -> absolute -> project-relative
        value = `/${
          relative(
            quartoPaths.projectRoot,
            validate(
              resolve(join(quartoPaths.currentFileDir, path.value)),
              quartoPaths,
            ),
          )
        }`;
      }
  }

  return {
    value,
    type: "project-relative",
    asAbsolute(info?: PathInfo) {
      return toAbsolutePath(this, info);
    },
    asProjectRelative(_info?: PathInfo) {
      return this;
    },
    asRelative(info?: PathInfo) {
      return toRelativePath(this, info);
    },
  };
}

function resolvePathInfo(path?: PathInfo): PathInfo {
  if (path !== undefined) {
    return path;
  }
  throw new Error("Unimplemented");
  // return {} as any; // FIXME this should get information from quarto's runtime.
}

function isRelativePath(path: QualifiedPath): path is RelativePath {
  return (path.type === "relative") ||
    (path.type === undefined && !path.value.startsWith("/"));
}

function isProjectRelativePath(
  path: QualifiedPath,
): path is ProjectRelativePath {
  return (path.type === "project-relative") ||
    (path.type === undefined && path.value.startsWith("/"));
}

function isAbsolutePath(path: QualifiedPath): path is AbsolutePath {
  return path.type === "absolute";
}
