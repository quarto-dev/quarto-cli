/*
* types.ts
*
* Copyright (C) 2020 by RStudio, PBC
*
*/

import { ProjectContext } from "../project/types.ts";

export type PublishDeployments = Record<string, Array<PublishRecord>>;

export type PublishRecord = {
  id: string;
  url: string;
};

export type PublishOptions = {
  input: ProjectContext | string;
  render: boolean;
  prompt: boolean;
  browser: boolean;
  siteId?: string;
};
