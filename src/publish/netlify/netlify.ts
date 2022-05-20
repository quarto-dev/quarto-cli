/*
* netlify.ts
*
* Copyright (C) 2020 by RStudio, PBC
*
*/

import { NetlifyClient } from "./api/index.ts";

export interface NetlifyOptions {
  token: string;
}

export async function netlifyPublish(options: NetlifyOptions) {
  const client = new NetlifyClient({
    TOKEN: options.token,
  });

  const sites = await client.site.listSites({});

  console.log(JSON.stringify(sites, undefined, 2));
}
