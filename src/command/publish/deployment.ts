/*
* deployment.ts
*
* Copyright (C) 2020 by RStudio, PBC
*
*/

import { warning } from "log/mod.ts";

import { prompt } from "cliffy/prompt/mod.ts";
import { Select } from "cliffy/prompt/select.ts";

import {
  findProvider,
  kPublishProviders,
  PublishDeployment,
} from "../../publish/provider.ts";

import { projectPublishConfig } from "../../publish/config.ts";

import { resolveAccount } from "./account.ts";
import { PublishOptions } from "./options.ts";

export async function resolveDeployment(
  options: PublishOptions,
  providerFilter?: string,
): Promise<PublishDeployment | undefined> {
  // enumerate any existing deployments
  const deployments = await publishDeployments(
    options,
    providerFilter,
  );
  if (deployments && deployments.length > 0) {
    // if a site-id was passed then try to match it
    const siteId = options["site-id"];
    if (siteId) {
      const deployment = deployments.find((deployment) => {
        return deployment.target?.site_id === siteId;
      });
      if (deployment) {
        return deployment;
      } else {
        throw new Error(
          `No previous publish with site-id ${siteId} was found`,
        );
      }
    } else if (deployments.length === 1) {
      if (!options.prompt) {
        return deployments[0];
      } else {
        if (await confirmDeployment(deployments[0])) {
          return deployments[0];
        }
      }
    } else {
      if (options.prompt) {
        const deployment = await chooseDeployment(deployments);
        if (deployment) {
          return deployment;
        }
      } else {
        throw new Error(
          `Multiple previous site publishes exists (specify one with --site-id when using --no-prompt)`,
        );
      }
    }
  }

  // if we get this far then an existing deployment has not been chosen,
  // if --no-prompt is specified then this is an error state
  if (!options.prompt) {
    throw new Error(
      `No previous publishes available to re-publish (previous publish required with --no-prompt)`,
    );
  }

  // determine provider
  let provider = providerFilter ? findProvider(providerFilter) : undefined;
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
    // determine account
    const account = await resolveAccount(provider, !!options.prompt);
    if (account) {
      return {
        provider,
        account,
      };
    }
  }
}

export async function publishDeployments(
  options: PublishOptions,
  providerFilter?: string,
): Promise<PublishDeployment[]> {
  const deployments: PublishDeployment[] = [];
  const config = await projectPublishConfig(options.target);
  for (const providerName of Object.keys(config)) {
    if (providerFilter && (providerName !== providerFilter)) {
      continue;
    }
    const provider = findProvider(providerName);
    if (provider) {
      const account = await resolveAccount(provider, !!options.prompt);
      if (account) {
        for (const site of config[providerName]) {
          const target = await provider.resolveTarget(account, {
            site_id: site,
          });
          deployments.push({
            provider,
            account,
            target,
          });
        }
      }
    } else {
      warning(`Unkonwn provider ${providerName}`);
    }
  }

  return deployments;
}

export function confirmDeployment(
  _deployment: PublishDeployment,
): Promise<boolean> {
  return Promise.resolve(true);
}

export function chooseDeployment(
  _depoyments: PublishDeployment[],
): Promise<PublishDeployment | undefined> {
  return Promise.resolve(undefined);
}
