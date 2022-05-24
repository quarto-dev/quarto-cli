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
import { handleUnauthorized } from "./account.ts";
import { updateProjectPublishConfig } from "../../publish/config.ts";
import { render, renderServices } from "../render/render-shared.ts";
import { projectOutputDir } from "../../project/project-shared.ts";

// TODO: implement deployments functions
// TODO: netlify methods

// TODO: render result / quarto inspect for publish (see R package)
// TOOO: site-url for render

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
    await publishAction(options, path);
  }),
);

async function publish(
  deployment: PublishDeployment,
  options: PublishOptions,
): Promise<void> {
  const provider = deployment.provider;
  try {
    // render if requested
    if (options.render) {
      const target = typeof (options.target) === "string"
        ? options.target
        : options.target.dir;
      const services = renderServices();
      try {
        const result = await render(target, { services });
        if (result.error) {
          throw result.error;
        }
      } finally {
        services.cleanup();
      }
    }

    // get output dir
    const outputDir = projectOutputDir(options.target);

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
  const publishOptions = await createPublishOptions(options, path);
  const deployment = await resolveDeployment(
    publishOptions,
    provider?.name,
  );
  if (deployment) {
    await publish(deployment, publishOptions);
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
    target: project,
    render: !!options.render,
    prompt: !!options.prompt,
    "site-id": options["site-id"],
  };
}

async function initYamlIntelligence() {
  setInitializer(initYamlIntelligenceResourcesFromFilesystem);
  await initState();
}
