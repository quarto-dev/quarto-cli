/*
 * inspect.ts
 *
 * Copyright (C) 2020-2022 Posit Software, PBC
 */

import { Format } from "../config/types.ts";
import {
  FileInclusion,
  ProjectConfig,
  ProjectFiles,
} from "../project/types.ts";

export type InspectedMdCell = {
  start: number;
  end: number;
  file: string;
  source: string;
  language: string;
  metadata: Record<string, unknown>;
};

export interface InspectedFile {
  includeMap: FileInclusion[];
  codeCells: InspectedMdCell[];
  metadata: Record<string, unknown>;
}

export interface InspectedConfig {
  quarto: {
    version: string;
  };
  engines: string[];
  fileInformation: Record<string, InspectedFile>;
}

export interface InspectedProjectConfig extends InspectedConfig {
  dir: string;
  config: ProjectConfig;
  files: ProjectFiles;
}

export interface InspectedDocumentConfig extends InspectedConfig {
  formats: Record<string, Format>;
  resources: string[];
  project?: InspectedProjectConfig;
}
