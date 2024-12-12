/*
 * cmd.ts
 *
 * Copyright (C) 2020-2022 Posit Software, PBC
 */

import { existsSync } from "../../deno_ral/fs.ts";

import { Command } from "cliffy/command/mod.ts";
import { Select } from "cliffy/prompt/select.ts";
import { prompt } from "cliffy/prompt/mod.ts";

import { findProvider } from "../../publish/provider.ts";

import { AccountToken, PublishProvider } from "../../publish/provider-types.ts";

import { publishProviders } from "../../publish/provider.ts";
import { initYamlIntelligenceResourcesFromFilesystem } from "../../core/schema/utils.ts";
import {
  initState,
  setInitializer,
} from "../../core/lib/yaml-validation/state.ts";
import {
  projectContext,
  projectInputFiles,
} from "../../project/project-context.ts";

import {
  projectIsManuscript,
  projectIsWebsite,
} from "../../project/project-shared.ts";

import { PublishCommandOptions } from "./options.ts";
import { resolveDeployment } from "./deployment.ts";
import { AccountPrompt, manageAccounts, resolveAccount } from "./account.ts";

import { PublishOptions, PublishRecord } from "../../publish/types.ts";
import { isInteractiveTerminal, isServerSession } from "../../core/platform.ts";
import { runningInCI } from "../../core/ci-info.ts";
import { ProjectContext } from "../../project/types.ts";
import { openUrl } from "../../core/shell.ts";
import { publishDocument, publishSite } from "../../publish/publish.ts";
import { handleUnauthorized } from "../../publish/account.ts";
import { notebookContext } from "../../render/notebook/notebook-context.ts";
import { singleFileProjectContext } from "../../project/types/single-file/single-file.ts";

export const publishCommand =
  // deno-lint-ignore no-explicit-any
  new Command<any>()
    .name("publish")
    .description(
      "Publish a document or project to a provider.\n\nAvailable providers include:\n\n" +
        " - Quarto Pub (quarto-pub)\n" +
        " - GitHub Pages (gh-pages)\n" +
        " - Posit Connect (connect)\n" +
        " - Posit Cloud (posit-cloud)\n" +
        " - Netlify (netlify)\n" +
        " - Confluence (confluence)\n" +
        " - Hugging Face Spaces (huggingface)\n\n" +
        "Accounts are configured interactively during publishing.\n" +
        "Manage/remove accounts with: quarto publish accounts",
    )
    .arguments("[provider] [path]")
    .option(
      "--id <id:string>",
      "Identifier of content to publish",
    )
    .option(
      "--server <server:string>",
      "Server to publish to",
    )
    .option(
      "--token <token:string>",
      "Access token for publising provider",
    )
    .option(
      "--no-render",
      "Do not render before publishing.",
    )
    .option(
      "--no-prompt",
      "Do not prompt to confirm publishing destination",
    )
    .option(
      "--no-browser",
      "Do not open a browser to the site after publishing",
    )
    .example(
      "Publish project (prompt for provider)",
      "quarto publish",
    )
    .example(
      "Publish document (prompt for provider)",
      "quarto publish document.qmd",
    )
    .example(
      "Publish project to Hugging Face Spaces",
      "quarto publish huggingface",
    )
    .example(
      "Publish project to Netlify",
      "quarto publish netlify",
    )
    .example(
      "Publish with explicit target",
      "quarto publish netlify --id DA36416-F950-4647-815C-01A24233E294",
    )
    .example(
      "Publish project to GitHub Pages",
      "quarto publish gh-pages",
    )
    .example(
      "Publish project to Posit Connect",
      "quarto publish connect",
    )
    .example(
      "Publish with explicit credentials",
      "quarto publish connect --server example.com --token 01A24233E294",
    )
    .example(
      "Publish project to Posit Cloud",
      "quarto publish posit-cloud",
    )
    .example(
      "Publish without confirmation prompt",
      "quarto publish --no-prompt",
    )
    .example(
      "Publish without rendering",
      "quarto publish --no-render",
    )
    .example(
      "Publish without opening browser",
      "quarto publish --no-browser",
    )
    .example(
      "Manage/remove publishing accounts",
      "quarto publish accounts",
    )
    .action(
      async (
        options: PublishCommandOptions,
        provider?: string,
        path?: string,
      ) => {
        // if provider is a path and no path is specified then swap
        if (provider && !path && existsSync(provider)) {
          path = provider;
          provider = undefined;
        }

        // if provider is 'accounts' then invoke account management ui
        if (provider === "accounts") {
          await manageAccounts();
        } else {
          let providerInterface: PublishProvider | undefined;
          if (provider) {
            providerInterface = findProvider(provider);
            if (!providerInterface) {
              throw new Error(`Publishing source '${provider}' not found`);
            }
          }
          await publishAction(options, providerInterface, path);
        }
      },
    );

async function publishAction(
  options: PublishCommandOptions,
  provider?: PublishProvider,
  path?: string,
) {
  await initYamlIntelligence();

  // coalesce options
  const publishOptions = await createPublishOptions(options, provider, path);

  // helper to publish (w/ account confirmation)
  const doPublish = async (
    publishProvider: PublishProvider,
    accountPrompt: AccountPrompt,
    publishTarget?: PublishRecord,
    account?: AccountToken,
  ) => {
    // enforce requiresRender
    if (publishProvider.requiresRender && publishOptions.render === false) {
      throw new Error(
        `${publishProvider.description} requires rendering before publish.`,
      );
    }

    // resolve account
    account = (account && !publishOptions.prompt)
      ? account
      : await resolveAccount(
        publishProvider,
        publishOptions.prompt ? accountPrompt : "never",
        publishOptions,
        account,
        publishTarget,
      );

    if (account) {
      // do the publish
      await publish(
        publishProvider,
        account,
        publishOptions,
        publishTarget,
      );
    }
  };

  // see if cli options give us a deployment
  const deployment = (provider && publishOptions.id)
    ? {
      provider,
      target: {
        id: publishOptions.id,
      },
    }
    : await resolveDeployment(
      publishOptions,
      provider?.name,
    );
  // update provider
  provider = deployment?.provider || provider;
  if (deployment) {
    // existing deployment
    await doPublish(
      deployment.provider,
      deployment.account ? "multiple" : "always",
      deployment.target,
      deployment.account,
    );
  } else if (publishOptions.prompt) {
    // new deployment, determine provider if needed
    const providers = publishProviders();
    if (!provider) {
      // select provider
      const result = await prompt([{
        indent: "",
        name: "provider",
        message: "Provider:",
        options: providers
          .filter((provider) => !provider.hidden)
          .map((provider) => ({
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

async function publish(
  provider: PublishProvider,
  account: AccountToken,
  options: PublishOptions,
  target?: PublishRecord,
): Promise<void> {
  try {
    const siteUrl = typeof (options.input) !== "string"
      ? await publishSite(
        options.input,
        provider,
        account,
        options,
        target,
      )
      : await publishDocument(
        options.input,
        provider,
        account,
        options,
        target,
      );

    // open browser if requested
    if (siteUrl && options.browser) {
      await openUrl(siteUrl.toString());
    }
  } catch (err) {
    // attempt to recover from unauthorized
    if (provider.isUnauthorized(err) && options.prompt) {
      if (await handleUnauthorized(provider, account)) {
        const authorizedAccount = await provider.authorizeToken(
          options,
          target,
        );
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

async function createPublishOptions(
  options: PublishCommandOptions,
  provider?: PublishProvider,
  path?: string,
): Promise<PublishOptions> {
  const nbContext = notebookContext();
  // validate path exists
  path = path || Deno.cwd();
  if (!existsSync(path)) {
    throw new Error(
      `The specified path (${path}) does not exist so cannot be published.`,
    );
  }
  // determine publish input
  let input: ProjectContext | string | undefined;

  if (provider && provider.resolveProjectPath) {
    const resolvedPath = provider.resolveProjectPath(path);
    try {
      if (Deno.statSync(resolvedPath).isDirectory) {
        path = resolvedPath;
      }
    } catch (_e) {
      // ignore
    }
  }

  // check for directory (either website or single-file project)
  const project = (await projectContext(path, nbContext)) ||
    singleFileProjectContext(path, nbContext);
  if (Deno.statSync(path).isDirectory) {
    if (projectIsWebsite(project)) {
      input = project;
    } else if (
      projectIsManuscript(project) && project.files.input.length > 0
    ) {
      input = project;
    } else if (project.files.input.length === 1) {
      input = project.files.input[0];
    } else {
      throw new Error(
        `The specified path (${path}) is not a website, manuscript or book project so cannot be published.`,
      );
    }
  } // single file path
  else {
    // if there is a project associated with this file then it can't be a website or book
    if (project && projectIsWebsite(project)) {
      throw new Error(
        `The specified path (${path}) is within a website or book project so cannot be published individually`,
      );
    }
    input = path;
  }

  const interactive = isInteractiveTerminal() && !runningInCI() && !options.id;
  return {
    input,
    server: options.server || null,
    token: options.token,
    id: options.id,
    render: !!options.render,
    prompt: !!options.prompt && interactive,
    browser: !!options.browser && interactive && !isServerSession(),
  };
}

async function initYamlIntelligence() {
  setInitializer(initYamlIntelligenceResourcesFromFilesystem);
  await initState();
}
