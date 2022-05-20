/*
* cmd.ts
*
* Copyright (C) 2020 by RStudio, PBC
*
*/

import { error } from "log/mod.ts";

import { prompt } from "cliffy/prompt/mod.ts";
import { Command } from "cliffy/command/mod.ts";
import { Select } from "cliffy/prompt/select.ts";

import { PublishOptions } from "./provider.ts";

import { ghpagesProvider } from "./ghpages.ts";
import { netlifyProvider } from "./netlify.ts";
import { exitWithCleanup } from "../../core/cleanup.ts";

const kPublishProviders = [netlifyProvider, ghpagesProvider];

export const publishCommand = withProviders(
  new Command()
    .name("publish")
    .arguments("[path:string]")
    .option(
      "--no-render",
      "Do not render before publishing.",
    )
    .option(
      "--no-prompt",
      "Do not prompt to confirm publishing destination",
    )
    .description(
      "Publish a document or project to a variety of destinations.",
      // deno-lint-ignore no-explicit-any
    ).action(async (options: any, path?: string) => {
      // shared options
      const publishOptions: PublishOptions = {
        path: path || Deno.cwd(),
        render: !!options.render,
        prompt: !!options.prompt,
      };

      // can't call base publish with no prompot
      if (!publishOptions.prompt) {
        error(
          "You must specify an explicit provider (e.g. 'netlify') with --no-prompt",
        );
        exitWithCleanup(1);
      }

      // select provider
      const result = await prompt([{
        name: "destination",
        message: "Select destination:",
        options: kPublishProviders.map((provider) => ({
          name: provider.description,
          value: provider.name,
        })),
        type: Select,
      }]);

      // call provider
      if (result.destination) {
        const provider = findProvider(result.destination);
        if (provider) {
          await provider.configure(publishOptions);
        }
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
          )
          .option(
            "--no-prompt",
            "Do not prompt to confirm publishing destination",
          ),
      ),
    );
  }
  return command;
}

function findProvider(name: string) {
  return kPublishProviders.find((provider) => provider.name === name);
}
