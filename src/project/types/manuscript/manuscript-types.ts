/*
 * manuscript-types.ts
 *
 * Copyright (C) 2020-2022 Posit Software, PBC
 */

import { kCodeLinks, kOtherLinks } from "../../../config/constants.ts";
import { NotebookPreviewDescriptor, OtherLink } from "../../../config/types.ts";

export const kManuscriptType = "manuscript";
export const kManuscriptUrl = "manuscript-url";
export const kMecaBundle = "meca-bundle";
export const kEnvironmentFiles = "environment";

export interface ManuscriptConfig {
  [kManuscriptUrl]?: string;
  [kMecaBundle]?: boolean | string;
  article?: string;
  notebooks?: Array<string | NotebookPreviewDescriptor>;
  resources?: string | string[];
  [kEnvironmentFiles]?: string | string[];
}

export interface ResolvedManuscriptConfig extends ManuscriptConfig {
  article: string;
  notebooks: Array<NotebookPreviewDescriptor>;
  [kCodeLinks]?: boolean | string | string[] | OtherLink[];
  mecaFile: string;
  [kEnvironmentFiles]?: string[];
}
