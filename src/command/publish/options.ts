/*
* options.ts
*
* Copyright (C) 2020-2023 Posit, PBC
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
