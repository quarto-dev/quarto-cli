/*
* cmd.ts
*
* Copyright (C) 2020 by RStudio, PBC
*
*/

import { info } from "log/mod.ts";

import { Command } from "cliffy/command/mod.ts";
import { Select } from "cliffy/prompt/select.ts";
import { prompt } from "cliffy/prompt/mod.ts";

import {
  AccountToken,
  findProvider,
  kPublishProviders,
  PublishProvider,
} from "../../publish/provider.ts";

import { initYamlIntelligenceResourcesFromFilesystem } from "../../core/schema/utils.ts";
import {
  initState,
  setInitializer,
} from "../../core/lib/yaml-validation/state.ts";
import {
  projectContext,
  projectIsWebsite,
} from "../../project/project-context.ts";

import {
  PublishCommandOptions,
  PublishOptions,
  withPublishOptions,
} from "./options.ts";
import { resolveDeployment } from "./deployment.ts";
import {
  AccountPrompt,
  handleUnauthorized,
  resolveAccount,
} from "./account.ts";
import { updateProjectPublishConfig } from "../../publish/config.ts";
import { render, renderServices } from "../render/render-shared.ts";
import { projectOutputDir } from "../../project/project-shared.ts";
import { PublishRecord } from "../../publish/types.ts";
import { renderProgress } from "../render/render-info.ts";

export const publishCommand = withProviders(
  withPublishOptions(
    new Command<PublishCommandOptions>()
      .name("publish")
      .description(
        "Publish a document or project to a variety of destinations.",
      )
      .hidden(),
  ).action(async (options: PublishCommandOptions, path?: string) => {
    await publishAction(options, path);
  }),
);

async function publish(
  provider: PublishProvider,
  account: AccountToken,
  options: PublishOptions,
  target?: PublishRecord,
): Promise<void> {
  try {
    // render if requested
    if (options.render) {
      renderProgress("\nRendering for publish:\n");
      const services = renderServices();
      try {
        const result = await render(options.project.dir, {
          services,
          flags: {
            siteUrl: target?.url,
          },
        });
        if (result.error) {
          throw result.error;
        }
      } finally {
        services.cleanup();
      }
    }

    // get output dir
    const outputDir = projectOutputDir(options.project);

    // publish
    const publishedTarget = await provider.publish(
      outputDir,
      account,
      target,
    );
    if (publishedTarget) {
      await updateProjectPublishConfig(options.project, {
        [provider.name]: [publishedTarget],
      });
    }
  } catch (err) {
    // attempt to recover from unauthorized
    if (provider.isUnauthorized(err) && options.prompt) {
      if (await handleUnauthorized(provider, account)) {
        if (await provider.authorizeToken()) {
          // recursve after re-authorization
          return await publish(provider, account, options, target);
        }
      }
    } else {
      throw err;
    }
  }
}

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
        await publishAction(options, path, provider);
      }),
    );
  }
  return command;
}

async function publishAction(
  options: PublishCommandOptions,
  path?: string,
  provider?: PublishProvider,
) {
  await initYamlIntelligence();

  // coalesce options
  const publishOptions = await createPublishOptions(options, path);

  // helper to publish (w/ account confirmation)
  const doPublish = async (
    publishProvider: PublishProvider,
    accountPrompt: AccountPrompt,
    publishTarget?: PublishRecord,
  ) => {
    const account = await resolveAccount(
      publishProvider,
      publishOptions.prompt ? accountPrompt : "never",
    );
    if (account) {
      await publish(
        publishProvider,
        account,
        publishOptions,
        publishTarget,
      );
    }
  };

  // see if we are redeploying
  const deployment = await resolveDeployment(
    publishOptions,
    provider?.name,
  );
  if (deployment) {
    // existing deployment
    await doPublish(deployment.provider, "multiple", deployment.target);
  } else if (publishOptions.prompt) {
    // new deployment, determine provider if needed
    if (!provider) {
      // select provider
      const result = await prompt([{
        name: "provider",
        message: "Select destination:",
        options: kPublishProviders.map((provider) => ({
          name: provider.description,
          value: provider.name,
        })),
        type: Select,
      }]);
      if (result.provider) {
        provider = findProvider(result.provider);
      }
    }
    if (provider) {
      await doPublish(provider, "always");
    }
  } else {
    throw new Error(
      "No re-publishing target found (--no-prompt requires an existing 'publish' config to update)",
    );
  }
}

async function createPublishOptions(
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
    project: project,
    render: !!options.render,
    prompt: !!options.prompt,
    "site-id": options["site-id"],
  };
}

async function initYamlIntelligence() {
  setInitializer(initYamlIntelligenceResourcesFromFilesystem);
  await initState();
}
