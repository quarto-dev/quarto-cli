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

import { exitWithCleanup } from "../../core/cleanup.ts";

import { PublishOptions, PublishProvider } from "../../publish/provider.ts";
import { netlifyProvider } from "../../publish/netlify/netlify.ts";

import { handleUnauthorized, resolveAccount } from "./account.ts";

const kPublishProviders = [netlifyProvider];

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
      const publishOptions = {
        path: path || Deno.cwd(),
        render: !!options.render,
        prompt: !!options.prompt,
      };

      // can't call base publish with no prompt
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
          await providerPublish(provider, publishOptions);
        }
      }
    }),
);

// deno-lint-ignore no-explicit-any
function withProviders(command: Command<any>): Command<any> {
  for (const provider of kPublishProviders) {
    command.command(
      provider.name,
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
        )
        // deno-lint-ignore no-explicit-any
        .action(async (options: any, path?: string) => {
          await providerPublish(provider, extractPublishOptions(options, path));
        }),
    );
  }
  return command;
}

export async function providerPublish(
  provider: PublishProvider,
  options: PublishOptions,
): Promise<boolean> {
  // resolve account
  const token = await resolveAccount(provider, options.prompt);
  if (token) {
    // attempt publish
    if (token) {
      try {
        await provider.publish(options, token);
        return true;
      } catch (err) {
        // attempt to recover from unauthorized
        if (provider.isUnauthorized(err)) {
          if (await handleUnauthorized(provider, token)) {
            if (await provider.authorizeToken()) {
              // recursve after re-authorization
              return await providerPublish(provider, options);
            }
          }
        } else {
          throw err;
        }
      }
    }
  }
  return false;
}

function findProvider(name: string) {
  return kPublishProviders.find((provider) => provider.name === name);
}

// deno-lint-ignore no-explicit-any
function extractPublishOptions(options: any, path?: string): PublishOptions {
  return {
    path: path || Deno.cwd(),
    render: !!options.render,
    prompt: !!options.prompt,
  };
}
