/*
* gh-pages.ts
*
* Copyright (C) 2020 by RStudio, PBC
*
*/

import { PublishOptions, publishSubcommand } from "./common.ts";

export const kGhpages = "ghpages";

export const ghpagesCommand = publishSubcommand(
  kGhpages,
  "Publish to GitHub Pages",
)
  // deno-lint-ignore no-explicit-any
  .action((options: any, path?: string) => {
    path = path || Deno.cwd();
    ghpagesPublish({
      path,
      render: !!options.render,
    });
    console.log("ghpages");
    console.log(path);
  });

export function ghpagesPublish(options: PublishOptions) {
  console.log("ghpages");
  console.log(options);
}
