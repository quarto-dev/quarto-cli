/*
 * manuscript-types.ts
 *
 * Copyright (C) 2020-2022 Posit Software, PBC
 */

import { NotebookPreviewDescriptor } from "../../../config/types.ts";

export const kManuscriptType = "manuscript";
export const kManuscriptUrl = "manuscript-url";
export const kMecaArchive = "meca-archive";

export interface ManuscriptConfig {
  [kManuscriptUrl]?: string;
  [kMecaArchive]?: boolean | string;
  article?: string;
  notebooks?: Array<string | NotebookPreviewDescriptor>;
  resources?: string | string[];
}

export interface ResolvedManuscriptConfig extends ManuscriptConfig {
  article: string;
  notebooks: Array<NotebookPreviewDescriptor>;
  mecaFile: string;
}
