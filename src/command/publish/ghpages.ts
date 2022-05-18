/*
* gh-pages.ts
*
* Copyright (C) 2020 by RStudio, PBC
*
*/

import { Command } from "cliffy/command/mod.ts";

import { PublishOptions, PublishProvider } from "./provider.ts";

export const ghpagesProvider: PublishProvider = {
  name: "ghpages",
  description: "GitHub Pages",
  command: (command: Command) => {
    return command
      // deno-lint-ignore no-explicit-any
      .action((options: any, path?: string) => {
        ghpagesConfigure({
          path: path || Deno.cwd(),
          render: !!options.render,
        });
      });
  },
  configure: ghpagesConfigure,
};

function ghpagesConfigure(options: PublishOptions) {
  console.log("ghpages");
  console.log(options);
}
