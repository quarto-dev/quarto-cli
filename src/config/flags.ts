/*
* flags.ts
*
* Copyright (C) 2020 by RStudio, PBC
*
*/

import { kSelfContained } from "./constants.ts";

export interface PandocFlags {
  to?: string;
  output?: string;
  [kSelfContained]?: boolean;
  pdfEngine?: string;
  pdfEngineOpts?: string[];
  natbib?: boolean;
  biblatex?: boolean;
  listings?: boolean;
  numberSections?: boolean;
}
