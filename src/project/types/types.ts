/*
* types.ts
*
* Copyright (C) 2020 by RStudio, PBC
*
*/

import { Format, FormatExtras, PandocFlags } from "../../config/types.ts";
import { Metadata } from "../../config/types.ts";
import {
  PandocRenderer,
  RenderFile,
  RenderFlags,
  RenderOptions,
} from "../../command/render/types.ts";
import { PandocOptions } from "../../command/render/types.ts";
import { ProjectConfig, ProjectContext } from "../types.ts";
import { TempContext } from "../../core/temp.ts";

export interface ProjectType {
  type: string;
  typeAliases?: string[];
  inheritsType?: string;
  templates?: string[];
  create: (title: string, template?: string) => ProjectCreate;
  config?: (
    projectDir: string,
    config: ProjectConfig,
    forceHtml: boolean,
    flags?: RenderFlags,
  ) => Promise<ProjectConfig>;
  libDir?: string;
  outputDir?: string;
  formatLibDirs?: () => string[];
  formatExtras?: (
    context: ProjectContext,
    input: string,
    flags: PandocFlags,
    format: Format,
    temp: TempContext,
  ) => Promise<FormatExtras>;
  projectFormatsOnly?: boolean;
  isSupportedFormat?: (format: Format) => boolean;
  metadataFields?: () => Array<string | RegExp>;
  filterParams?: (options: PandocOptions) => Metadata | undefined;
  resourceIgnoreFields?: () => string[];
  navItemText?: (
    context: ProjectContext,
    input: string,
    text: string,
  ) => Promise<string>;
  incrementalRenderAll?: (
    context: ProjectContext,
    options: RenderOptions,
    files: string[],
  ) => Promise<boolean>;
  preRender?: (context: ProjectContext) => Promise<void>;
  pandocRenderer?: (
    options: RenderOptions,
    context: ProjectContext,
  ) => PandocRenderer;
  supplementRender?: (
    project: ProjectContext,
    files: RenderFile[],
    incremental: boolean,
  ) => {
    files: RenderFile[];
    onRenderComplete?: (
      project: ProjectContext,
      files: string[],
      incremental: boolean,
    ) => Promise<void>;
  };
  postRender?: (
    context: ProjectContext,
    incremental: boolean,
    outputFiles: ProjectOutputFile[],
  ) => Promise<void>;
}

export interface ProjectOutputFile {
  file: string;
  format: Format;
}

export interface ProjectCreate {
  configTemplate: string;
  resourceDir: string;
  scaffold?: (
    engine: string,
    kernel?: string,
    packages?: string[],
  ) => ProjectScaffoldFile[];
  supporting?: (string | {
    from: string;
    to: string;
  })[];
}

export interface ProjectScaffoldFile {
  name: string;
  content: string;
  noEngineContent?: boolean;
  title?: string;
  yaml?: string;
  subdirectory?: string;
  supporting?: string[];
}
