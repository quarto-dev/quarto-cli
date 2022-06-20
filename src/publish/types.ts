/*
* types.ts
*
* Copyright (C) 2020 by RStudio, PBC
*
*/

import { ProjectContext } from "../project/types.ts";

export type PublishDeployments = {
  dir: string;
  source: string;
  records: Record<string, Array<PublishRecord>>;
};

export type PublishRecord = {
  id: string;
  url?: string;
  code?: boolean;
};

export type PublishOptions = {
  input: ProjectContext | string;
  server?: string | null;
  token?: string;
  id?: string;
  render: boolean;
  prompt: boolean;
  browser: boolean;
};
