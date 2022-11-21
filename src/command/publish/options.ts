/*
* options.ts
*
* Copyright (C) 2020-2022 Posit Software, PBC
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
