/*
* cmd.ts
*
* Copyright (C) 2020 by RStudio, PBC
*
*/

import { Command } from "cliffy/command/mod.ts";
import { Select } from "cliffy/prompt/select.ts";

import { PublishOptions } from "./provider.ts";

import { ghpagesProvider } from "./ghpages.ts";
import { netlifyProvider } from "./netlify.ts";

const kPublishProviders = [netlifyProvider, ghpagesProvider];

export const publishCommand = withProviders(
  new Command()
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

      // select provider
      const name: string = await Select.prompt({
        message: "Select destination:",
        options: kPublishProviders.map((provider) => ({
          name: provider.description,
          value: provider.name,
        })),
      });

      // call provider
      const provider = findProvider(name);
      if (provider) {
        provider.configure(publishOptions);
      }
    }),
);

// deno-lint-ignore no-explicit-any
function withProviders(command: Command<any>): Command<any> {
  for (const provider of kPublishProviders) {
    command.command(
      provider.name,
      provider.command(
        new Command()
          .name(provider.name)
          .description(provider.description)
          .arguments("[path:string]")
          .option(
            "--no-render",
            "Do not render before publishing.",
          ),
      ),
    );
  }
  return command;
}

function findProvider(name: string) {
  return kPublishProviders.find((provider) => provider.name === name);
}
