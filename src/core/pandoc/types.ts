/*
* types.ts
*
* Copyright (C) 2020-2022 Posit Software, PBC
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
  srcMarkdownNoYaml: string;
}
