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
  create: (title: string) => ProjectCreate;
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
    files: string[],
  ) => string[];
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
  supporting?: string[];
}

export interface ProjectScaffoldFile {
  name: string;
  content: string;
  noEngineContent?: boolean;
  title?: string;
}
