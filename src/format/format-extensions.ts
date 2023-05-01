/*
 * format-extensions.ts
 *
 * Copyright (C) 2020-2023 Posit Software, PBC
 */

import { RenderContext } from "../command/render/types.ts";
import { Format } from "../config/types.ts";

export const kNoteBookExtension = "notebooks";

export interface NotebooksFormatExtension {
  processNotebooks: (
    input: string,
    format: Format,
    notebooks: string[],
    context: RenderContext,
  ) => Promise<{
    includes?: {
      inHeader?: string[];
      afterBody?: string[];
    };
    supporting?: string[];
  }>;
}
