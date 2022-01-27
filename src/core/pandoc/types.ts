/*
* types.ts
*
* Copyright (C) 2020 by RStudio, PBC
*
*/

import { Metadata } from "../../config/types.ts";

export interface PandocAttr {
  id: string;
  classes: string[];
  keyvalue: Array<[string, string]>;
}

export interface PartitionedMarkdown {
  yaml?: Metadata;
  headingText?: string;
  headingAttr?: PandocAttr;
  containsRefs: boolean;
  markdown: string;
}
