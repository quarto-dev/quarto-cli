/*
* netlify.ts
*
* Copyright (C) 2020 by RStudio, PBC
*
*/

import { Command } from "cliffy/command/mod.ts";

import { PublishOptions, PublishProvider } from "./provider.ts";

export const netlifyProvider: PublishProvider = {
  name: "netlify",
  description: "Netlify",
  command: (command: Command) => {
    return command
      // deno-lint-ignore no-explicit-any
      .action((options: any, path?: string) => {
        netlifyConfigure({
          path: path || Deno.cwd(),
          render: !!options.render,
        });
      });
  },
  configure: netlifyConfigure,
};

function netlifyConfigure(options: PublishOptions) {
  console.log("netlify");
  console.log(options);
}
