/*
* flags.ts
*
* Copyright (C) 2020 by RStudio, PBC
*
*/

import {
  kListings,
  kNumberOffset,
  kNumberSections,
  kSelfContained,
  kTopLevelDivision,
} from "./constants.ts";

export interface PandocFlags {
  to?: string;
  output?: string;
  [kSelfContained]?: boolean;
  pdfEngine?: string;
  pdfEngineOpts?: string[];
  natbib?: boolean;
  biblatex?: boolean;
  [kListings]?: boolean;
  [kNumberSections]?: boolean;
  [kNumberOffset]?: number[];
  [kTopLevelDivision]?: string;
}
