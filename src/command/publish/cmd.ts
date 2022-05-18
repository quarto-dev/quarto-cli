/*
* cmd.ts
*
* Copyright (C) 2020 by RStudio, PBC
*
*/

import { Command } from "cliffy/command/mod.ts";
import { Select } from "cliffy/prompt/select.ts";
import { PublishOptions } from "./common.ts";

import { ghpagesCommand, ghpagesPublish, kGhpages } from "./ghpages.ts";
import { kNetlify, netlifyCommand, netlifyPublish } from "./netlify.ts";

export const publishCommand = new Command()
  .name("publish")
  .arguments("[path:string]")
  .option(
    "--no-render",
    "Do not render before publishing.",
  )
  .description(
    "Publish a document or project to a variety of destinations.",
    // deno-lint-ignore no-explicit-any
  ).action(async (options: any, path?: string) => {
    // shared options
    const publishOptions: PublishOptions = {
      path: path || Deno.cwd(),
      render: !!options.render,
    };

    // select method
    const method: string = await Select.prompt({
      message: "Select destination:",
      options: [
        { name: "Netlify", value: kNetlify },
        { name: "GitHub Pages", value: kGhpages },
      ],
    });

    switch (method) {
      case kNetlify:
        netlifyPublish(publishOptions);
        break;

      case kGhpages:
        ghpagesPublish(publishOptions);
        break;
    }
  })
  .command(kNetlify, netlifyCommand)
  .command(kGhpages, ghpagesCommand);
