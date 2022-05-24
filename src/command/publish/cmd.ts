/*
* cmd.ts
*
* Copyright (C) 2020 by RStudio, PBC
*
*/

import { prompt } from "cliffy/prompt/mod.ts";
import { Command } from "cliffy/command/mod.ts";
import { Select } from "cliffy/prompt/select.ts";

import { PublishOptions, PublishProvider } from "../../publish/provider.ts";
import { netlifyProvider } from "../../publish/netlify/netlify.ts";

import { handleUnauthorized, resolveAccount } from "./account.ts";
import { initYamlIntelligenceResourcesFromFilesystem } from "../../core/schema/utils.ts";
import {
  initState,
  setInitializer,
} from "../../core/lib/yaml-validation/state.ts";
import {
  projectContext,
  projectIsWebsite,
} from "../../project/project-context.ts";
import { resolveTarget } from "./target.ts";

const kPublishProviders = [netlifyProvider];

interface PublishCommandOptions {
  render?: boolean;
  prompt?: boolean;
}

export const publishCommand = withProviders(
  withPublishOptions(
    new Command<PublishCommandOptions>()
      .name("publish")
      .description(
        "Publish a document or project to a variety of destinations.",
      )
      .hidden(),
  ).action(async (options: PublishCommandOptions, path?: string) => {
    // init yaml intelligence
    await initYamlIntelligence();

    // shared options
    const publishOptions = await extractPublishOptions(options, path);

    // can't call base publish with no prompt
    if (!publishOptions.prompt) {
      throw new Error(
        "You must specify an explicit provider (e.g. 'netlify') with --no-prompt",
      );
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

function withProviders(
  command: Command<PublishCommandOptions>,
): Command<PublishCommandOptions> {
  for (const provider of kPublishProviders) {
    command.command(
      provider.name,
      withPublishOptions(
        new Command<PublishCommandOptions>()
          .name(provider.name)
          .description(provider.description),
      ).action(async (options: PublishCommandOptions, path?: string) => {
        await initYamlIntelligence();
        await providerPublish(
          provider,
          await extractPublishOptions(options, path),
        );
      }),
    );
  }
  return command;
}

function withPublishOptions(
  command: Command<PublishCommandOptions>,
  // deno-lint-ignore no-explicit-any
): Command<any> {
  return command
    .arguments("[path:string]")
    .option(
      "--no-render",
      "Do not render before publishing.",
    )
    .option(
      "--no-prompt",
      "Do not prompt to confirm publishing destination",
    );
}

export async function providerPublish(
  provider: PublishProvider,
  options: PublishOptions,
): Promise<boolean> {
  // resolve account
  const token = await resolveAccount(provider, options.prompt);
  if (token) {
    try {
      const target = await resolveTarget(provider, options);
      await provider.publish(options, target, token);
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
  return false;
}

function findProvider(name: string) {
  return kPublishProviders.find((provider) => provider.name === name);
}

async function extractPublishOptions(
  options: PublishCommandOptions,
  path?: string,
): Promise<PublishOptions> {
  path = path || Deno.cwd();
  // ensure that we have a project to publish
  const project = await projectContext(path);
  if (!project || !projectIsWebsite(project)) {
    throw new Error(
      `The specified path (${path}) is not a website or book project so cannot be published.`,
    );
  }
  return {
    target: project,
    render: !!options.render,
    prompt: !!options.prompt,
  };
}

async function initYamlIntelligence() {
  setInitializer(initYamlIntelligenceResourcesFromFilesystem);
  await initState();
}
