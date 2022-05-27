/*
* cmd.ts
*
* Copyright (C) 2020 by RStudio, PBC
*
*/

import { walkSync } from "fs/mod.ts";

import { relative } from "path/mod.ts";

import { Command } from "cliffy/command/mod.ts";
import { Select } from "cliffy/prompt/select.ts";
import { prompt } from "cliffy/prompt/mod.ts";

import {
  AccountToken,
  findProvider,
  kPublishProviders,
  PublishFiles,
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

import { PublishCommandOptions, PublishOptions } from "./options.ts";
import { resolveDeployment } from "./deployment.ts";
import {
  AccountPrompt,
  handleUnauthorized,
  resolveAccount,
} from "./account.ts";
import { recordProjectPublishDeployment } from "../../publish/config.ts";
import { render, renderServices } from "../render/render-shared.ts";
import { projectOutputDir } from "../../project/project-shared.ts";
import { PublishRecord } from "../../publish/types.ts";
import { renderProgress } from "../render/render-info.ts";
import { isInteractiveTerminal } from "../../core/platform.ts";
import { runningInCI } from "../../core/ci-info.ts";
import { openUrl } from "../../core/shell.ts";

export const publishCommand = withProviders(
  // deno-lint-ignore no-explicit-any
  new Command<any>()
    .name("publish")
    .hidden()
    .description(
      "Publish a document or project to a variety of destinations.",
    )
    .arguments("[path:string]")
    .option(
      "--no-render",
      "Do not render before publishing.",
      { global: true },
    )
    .option(
      "--no-prompt",
      "Do not prompt to confirm publishing destination",
      { global: true },
    )
    .option(
      "--no-browser",
      "Do not open a browser to the site after publishing",
      { global: true },
    )
    .option(
      "--site-id <id:string>",
      "Identifier of site to publish",
      { global: true },
    )
    .action(async (options: PublishCommandOptions, path?: string) => {
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
    // get output dir
    const outputDir = projectOutputDir(options.project);

    // create render function
    const renderForPublish = async (siteUrl: string): Promise<PublishFiles> => {
      if (options.render) {
        renderProgress("Rendering for publish:\n");
        const services = renderServices();
        try {
          const result = await render(options.project.dir, {
            services,
            flags: {
              siteUrl,
            },
          });
          if (result.error) {
            throw result.error;
          }
        } finally {
          services.cleanup();
        }
      }
      // return PublishFiles
      const files: string[] = [];
      for (const walk of walkSync(outputDir)) {
        if (walk.isFile) {
          files.push(relative(outputDir, walk.path));
        }
      }
      return {
        baseDir: outputDir,
        files,
      };
    };

    // publish
    const [publishRecord, siteUrl] = await provider.publish(
      account,
      renderForPublish,
      target,
    );
    if (publishRecord) {
      recordProjectPublishDeployment(
        options.project,
        provider.name,
        publishRecord,
      );
    }

    // open browser if requested
    if (options.browser) {
      await openUrl(siteUrl.toString());
    }
  } catch (err) {
    // attempt to recover from unauthorized
    if (provider.isUnauthorized(err) && options.prompt) {
      if (await handleUnauthorized(provider, account)) {
        const authorizedAccount = await provider.authorizeToken();
        if (authorizedAccount) {
          // recursve after re-authorization
          return await publish(provider, authorizedAccount, options, target);
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
      new Command<PublishCommandOptions>()
        .name(provider.name)
        .description(provider.description)
        .action(async (options: PublishCommandOptions, path?: string) => {
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
        indent: "",
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
  const interactive = isInteractiveTerminal() && !runningInCI();
  return {
    project: project,
    render: !!options.render,
    prompt: !!options.prompt && interactive,
    browser: !!options.browser && interactive,
    siteId: options.siteId,
  };
}

async function initYamlIntelligence() {
  setInitializer(initYamlIntelligenceResourcesFromFilesystem);
  await initState();
}
