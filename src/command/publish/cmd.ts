/*
* cmd.ts
*
* Copyright (C) 2020 by RStudio, PBC
*
*/

import { Command } from "cliffy/command/mod.ts";

import {
  kPublishProviders,
  PublishDeployment,
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
import { handleUnauthorized } from "./account.ts";
import { updateProjectPublishConfig } from "../../publish/config.ts";
import { render, renderServices } from "../render/render-shared.ts";
import { projectOutputDir } from "../../project/project-shared.ts";

// TODO: don't keep re-reading the project context (accomodate non-project in various ways)
// TODO: implement deployments functions
// TODO: netlify methods
// TODO: render (w/ no-render message)

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
    const publishOptions = await createPublishOptions(options, path);
    const deployment = await resolveDeployment(publishOptions);
    if (deployment) {
      await publish(deployment, publishOptions);
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
        const publishOptions = await createPublishOptions(options, path);
        const deployment = await resolveDeployment(
          publishOptions,
          provider.name,
        );
        if (deployment) {
          await publish(deployment, publishOptions);
        }
      }),
    );
  }
  return command;
}

async function publish(
  deployment: PublishDeployment,
  options: PublishOptions,
): Promise<void> {
  const provider = deployment.provider;
  try {
    // render if requested
    if (options.render) {
      const services = renderServices();
      try {
        const result = await render(options.target, { services });
        if (result.error) {
          throw result.error;
        }
      } finally {
        services.cleanup();
      }
    }

    // get output dir
    const project = (await projectContext(options.target))!;
    const outputDir = projectOutputDir(project);

    // publish
    const publishedTarget = await provider.publish(outputDir, deployment);
    if (publishedTarget) {
      await updateProjectPublishConfig(options.target, {
        [deployment.provider.name]: [publishedTarget.site_id],
      });
    }
  } catch (err) {
    // attempt to recover from unauthorized
    if (provider.isUnauthorized(err) && options.prompt) {
      if (await handleUnauthorized(deployment)) {
        if (await provider.authorizeToken()) {
          // recursve after re-authorization
          return await publish(deployment, options);
        }
      }
    } else {
      throw err;
    }
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
    target: project.dir,
    render: !!options.render,
    prompt: !!options.prompt,
    "site-id": options["site-id"],
  };
}

async function initYamlIntelligence() {
  setInitializer(initYamlIntelligenceResourcesFromFilesystem);
  await initState();
}
