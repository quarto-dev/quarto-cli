/*
* flags.ts
*
* Copyright (C) 2020 by RStudio, PBC
*
*/

import {
  kIncludeAfterBody,
  kIncludeBeforeBody,
  kIncludeInHeader,
  kListings,
  kNumberOffset,
  kNumberSections,
  kSelfContained,
  kShiftHeadingLevelBy,
  kToc,
  kTocTitle,
  kTopLevelDivision,
} from "./constants.ts";

export interface PandocFlags {
  to?: string;
  output?: string;
  [kSelfContained]?: boolean;
  pdfEngine?: string;
  pdfEngineOpts?: string[];
  makeIndexOpts?: string[];
  tlmgrOpts?: string[];
  natbib?: boolean;
  biblatex?: boolean;
  [kToc]?: boolean;
  [kTocTitle]?: string;
  [kListings]?: boolean;
  [kNumberSections]?: boolean;
  [kNumberOffset]?: number[];
  [kTopLevelDivision]?: string;
  [kShiftHeadingLevelBy]?: string;
  [kIncludeInHeader]?: string;
  [kIncludeBeforeBody]?: string;
  [kIncludeAfterBody]?: string;
}
