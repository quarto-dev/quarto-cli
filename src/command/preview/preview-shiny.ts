/*
 * preview-shiny.ts
 *
 * Copyright (C) 2020-2022 Posit Software, PBC
 */

import { RunOptions } from "../../execute/types.ts";
import { ProjectContext } from "../../project/types.ts";
import { Format } from "../../config/types.ts";
import { serve } from "../serve/serve.ts";

export interface PreviewShinyOptions extends RunOptions {
  format: Format;
  project?: ProjectContext;
}

export async function previewShiny(options: PreviewShinyOptions) {
  return await serve(options);
}
