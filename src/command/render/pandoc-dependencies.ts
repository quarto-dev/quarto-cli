/*
 * pandoc-dependencies.ts
 *
 * Copyright (C) 2020-2022 Posit Software, PBC
 */

import { DependencyFile, FormatDependency } from "../../config/types.ts";
import { appendTextFile } from "../../core/file.ts";

export interface HtmlFormatDependency {
  type: "html";
  content: FormatDependency;
}

export interface HtmlAttachmentDependency {
  type: "html-attachment";
  content: {
    name: string;
    file: DependencyFile;
  };
}

export interface FormatResourceDependency {
  type: "format-resources";
  content: {
    file: string;
  };
}

export interface TextDependency {
  type: "text";
  content: {
    text: string;
    location: "before-body" | "after-body" | "in-header";
  };
}

export interface FileDependency {
  type: "file";
  content: {
    path: string;
  };
}

export interface UsePackageDependency {
  type: "usepackage";
  content: {
    package: string;
    options: string;
  };
}

export async function appendDependencies(
  dependenciesFile: string,
  dependencies: Array<
    | HtmlFormatDependency
    | HtmlAttachmentDependency
    | FormatResourceDependency
    | TextDependency
    | FileDependency
    | UsePackageDependency
  >,
) {
  const dependencyLines: string[] = [];
  for (const dependency of dependencies) {
    dependencyLines.push(
      JSON.stringify(dependency),
    );
  }
  if (dependencyLines.length > 0) {
    await appendTextFile(
      dependenciesFile,
      `${dependencyLines.join("\n")}\n`,
    );
  }
}
