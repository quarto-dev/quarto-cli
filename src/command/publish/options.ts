/*
* options.ts
*
* Copyright (C) 2020 by RStudio, PBC
*
*/

export interface PublishCommandOptions {
  token?: string;
  server?: string | null;
  id?: string;
  render?: boolean;
  prompt?: boolean;
  browser?: boolean;
}
