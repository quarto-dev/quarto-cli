/*
* netlify.ts
*
* Copyright (C) 2020 by RStudio, PBC
*
*/

import { NetlifyClient } from "./netlify/index.ts";

export interface NetlifyOptions {
  site: string;
}

export async function netlifyPublish(_options?: NetlifyOptions) {
}
