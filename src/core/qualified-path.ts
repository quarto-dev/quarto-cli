/*
* qualified-path.ts
*
* Path objects that hold additional information about their status
*
* Copyright (C) 2022 by RStudio, PBC
*
*/

import { join, relative, resolve } from "path/mod.ts";
import {
  AbsolutePath,
  CwdRelativePath,
  DocumentInfo,
  DocumentRelativePath,
  ProjectInfo,
  ProjectRelativePath,
} from "./qualified-path-types.ts";

import { isAbsolute } from "path/mod.ts";

export class InvalidPathError extends Error {
  constructor(msg: string) {
    super(msg);
  }
}

export function makeAbsolutePath(path: string): AbsolutePath {
  if (!isAbsolute(path)) {
    throw new InvalidPathError(`path ${path} must be absolute`);
  }
  return {
    type: "absolute",
    value: path,
    asCwdRelative() {
      return makeCwdRelativePath(relative(Deno.cwd(), this.value));
    },
    asDocumentRelative(info: DocumentInfo) {
      return makeDocumentRelativePath(relative(info.documentDir, this.value));
    },
    asProjectRelative(info: ProjectInfo) {
      return makeProjectRelativePath(
        `/${relative(info.projectDir, this.value)}`,
      );
    },
  };
}

export function makeCwdRelativePath(path: string): CwdRelativePath {
  if (path.startsWith("/")) {
    throw new InvalidPathError(`path ${path} must be relative`);
  }
  return {
    type: "cwd-relative",
    value: path,
    asAbsolute() {
      return makeAbsolutePath(resolve(join(Deno.cwd(), this.value)));
    },
    asDocumentRelative(info: DocumentInfo) {
      return makeDocumentRelativePath(
        relative(info.documentDir, resolve(join(Deno.cwd(), this.value))),
      );
    },
    asProjectRelative(info: ProjectInfo) {
      return makeProjectRelativePath(
        `/${relative(info.projectDir, resolve(join(Deno.cwd(), this.value)))}`,
      );
    },
  };
}

export function makeDocumentRelativePath(path: string): DocumentRelativePath {
  if (path.startsWith("/")) {
    throw new InvalidPathError(`path ${path} must be relative`);
  }
  return {
    type: "document-relative",
    value: path,
    asAbsolute(info: DocumentInfo) {
      return makeAbsolutePath(resolve(join(info.documentDir, this.value)));
    },
    asCwdRelative(info: DocumentInfo) {
      return makeCwdRelativePath(
        relative(Deno.cwd(), resolve(join(info.documentDir, this.value))),
      );
    },
    asProjectRelative(info: DocumentInfo & ProjectInfo) {
      return makeProjectRelativePath(
        `/${
          relative(info.projectDir, resolve(join(info.documentDir, this.value)))
        }`,
      );
    },
  };
}

export function makeProjectRelativePath(path: string): ProjectRelativePath {
  return {
    type: "project-relative",
    value: path,
    asAbsolute(info: ProjectInfo) {
      return makeAbsolutePath(resolve(join(info.projectDir, this.value)));
    },
    asCwdRelative(info: ProjectInfo) {
      return makeCwdRelativePath(
        relative(Deno.cwd(), resolve(join(info.projectDir, this.value))),
      );
    },
    asDocumentRelative(info: DocumentInfo & ProjectInfo) {
      return makeDocumentRelativePath(
        relative(info.documentDir, resolve(join(info.projectDir, this.value))),
      );
    },
  };
}
