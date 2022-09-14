/*
* qualified-path-types.ts
*
* Types for qualified-path.ts
*
* Copyright (C) 2022 by RStudio, PBC
*
*/

export type ProjectInfo = { projectDir: string };
export type DocumentInfo = { documentDir: string };

export type ProjectRelativePath = {
  value: string;
  asAbsolute: (info: ProjectInfo) => AbsolutePath;
  asCwdRelative: (info: ProjectInfo) => CwdRelativePath;
  asDocumentRelative: (
    info: ProjectInfo & DocumentInfo,
  ) => DocumentRelativePath;
  type: "project-relative";
};

export type AbsolutePath = {
  value: string;
  asCwdRelative: () => CwdRelativePath;
  asDocumentRelative: (info: DocumentInfo) => DocumentRelativePath;
  asProjectRelative: (info: ProjectInfo) => ProjectRelativePath;
  type: "absolute";
};

export type DocumentRelativePath = {
  value: string;
  asAbsolute: (info: DocumentInfo) => AbsolutePath;
  asCwdRelative: (info: DocumentInfo) => CwdRelativePath;
  asProjectRelative: (
    info: DocumentInfo & ProjectInfo,
  ) => ProjectRelativePath;
  type: "document-relative";
};

export type CwdRelativePath = {
  value: string;
  asAbsolute: () => AbsolutePath;
  asDocumentRelative: (info: DocumentInfo) => DocumentRelativePath;
  asProjectRelative: (info: ProjectInfo) => ProjectRelativePath;
  type: "cwd-relative";
};
