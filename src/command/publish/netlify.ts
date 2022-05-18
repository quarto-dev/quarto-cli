/*
* netlify.ts
*
* Copyright (C) 2020 by RStudio, PBC
*
*/

import { PublishOptions, publishSubcommand } from "./common.ts";

export const kNetlify = "netlify";

export const netlifyCommand = publishSubcommand(kNetlify, "Publish to netlify")
  // deno-lint-ignore no-explicit-any
  .action((options: any, path?: string) => {
    path = path || Deno.cwd();
    netlifyPublish({
      path,
      render: !!options.render,
    });
  });

export function netlifyPublish(options: PublishOptions) {
  console.log("netlify");
  console.log(options);
}
