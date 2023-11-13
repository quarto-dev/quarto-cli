/*
 * project-environment.ts
 *
 * Copyright (C) 2021-2023 Posit Software, PBC
 */

import { GitHubContext } from "../core/github-types.ts";
import { SemVer } from "semver/mod.ts";

export type QuartoEditor = "vscode" | "rstudio" | "jupyterlab";
export type QuartoVersion = "release" | "prerelease" | SemVer;
export type QuartoTool = "tinytex" | "chromium";

export interface ProjectEnvironment {
  title: string;
  tools: Array<QuartoTool>;
  codeEnvironment: QuartoEditor;
  engines: string[];
  quarto: QuartoVersion;
  environments: string[];
  openFiles: string[];
  envVars: Record<string, string>;
  github: GitHubContext;
}
