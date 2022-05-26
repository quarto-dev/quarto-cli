/*
* options.ts
*
* Copyright (C) 2020 by RStudio, PBC
*
*/

import { ProjectContext } from "../../project/types.ts";

export type PublishOptions = {
  project: ProjectContext;
  render: boolean;
  prompt: boolean;
  browser: boolean;
  siteId?: string;
};

export interface PublishCommandOptions {
  render?: boolean;
  prompt?: boolean;
  browser?: boolean;
  siteId?: string;
}
