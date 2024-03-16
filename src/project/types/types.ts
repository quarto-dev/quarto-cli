/*
 * types.ts
 *
 * Copyright (C) 2020-2022 Posit Software, PBC
 */

import { Format, FormatExtras, PandocFlags } from "../../config/types.ts";
import { Metadata } from "../../config/types.ts";
import {
  PandocRenderer,
  RenderFile,
  RenderFlags,
  RenderOptions,
  RenderResult,
  RenderResultFile,
  RenderServices,
} from "../../command/render/types.ts";
import { PandocOptions } from "../../command/render/types.ts";
import { InputTarget, ProjectConfig, ProjectContext } from "../types.ts";

export interface ProjectType {
  type: string;
  typeAliases?: string[];
  inheritsType?: string;
  templates?: string[];
  create: (title: string, template?: string) => ProjectCreate;
  config?: (
    project: ProjectContext,
    config: ProjectConfig,
    flags?: RenderFlags,
  ) => Promise<ProjectConfig>;
  libDir?: string;
  outputDir?: string;
  outputFile?: (
    input: string,
    format: Format,
    project: ProjectContext,
  ) => string | undefined;
  cleanOutputDir?: boolean;
  formatLibDirs?: () => string[];
  filterFormat?: (
    source: string,
    format: Format,
    project?: ProjectContext,
  ) => Format;
  formatExtras?: (
    context: ProjectContext,
    input: string,
    flags: PandocFlags,
    format: Format,
    services: RenderServices,
  ) => Promise<FormatExtras>;
  previewSkipUnmodified?: boolean;
  renderResultFinalOutput?: (
    renderResults: RenderResult,
    relativeToInputDir?: string,
  ) => RenderResultFile | undefined;
  projectFormatsOnly?: boolean;
  incrementalFormatPreviewing?: boolean; // Use the input format for a requested output file in the preview server
  isSupportedFormat?: (format: Format) => boolean;
  metadataFields?: () => Array<string | RegExp>;
  filterParams?: (options: PandocOptions) => Promise<Metadata | undefined>;
  resourceIgnoreFields?: () => string[];
  navItemText?: (
    context: ProjectContext,
    input: string,
    text: string,
    number: boolean,
  ) => Promise<{ html: string; text: string }>;
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
  filterInputTarget?: (
    inputTarget: InputTarget,
    project: ProjectContext,
  ) => InputTarget;
  beforeMoveOutput?: (
    context: ProjectContext,
    renderedFiles: RenderResultFile[],
  ) => Promise<Record<string, unknown> | undefined>;
  postRender?: (
    context: ProjectContext,
    incremental: boolean,
    outputFiles: ProjectOutputFile[],
    moveOutputResult?: Record<string, unknown>,
  ) => Promise<void>;
  formatOutputDirectory?: (
    format: Format,
  ) => string | undefined;
  selfContainedOutput?: (format: Format) => boolean;
}

export interface ProjectOutputFile {
  file: string;
  input: string;
  format: Format;
  resources: string[];
  supporting?: string[];
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
