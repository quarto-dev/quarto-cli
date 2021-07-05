/*
* types.ts
*
* Copyright (C) 2020 by RStudio, PBC
*
*/

export interface PandocAttr {
  id: string;
  classes: string[];
  keyvalue: Array<[string, string]>;
}

export interface PartitionedMarkdown {
  yaml?: string;
  headingText?: string;
  headingAttr?: PandocAttr;
  containsRefs: boolean;
  markdown: string;
}
