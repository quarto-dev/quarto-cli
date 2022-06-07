/*
* deployment.ts
*
* Copyright (C) 2020 by RStudio, PBC
*
*/

import { warning } from "log/mod.ts";

import { Select } from "cliffy/prompt/select.ts";
import { Confirm } from "cliffy/prompt/confirm.ts";

import { findProvider, PublishDeployment } from "../../publish/provider.ts";

import { resolveAccount } from "./account.ts";
import { PublishOptions } from "../../publish/types.ts";
import {
  readProjectPublishDeployments,
  readPublishDeployments,
} from "../../publish/config.ts";

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
    const siteId = options.siteId;
    if (siteId) {
      const deployment = deployments.find((deployment) => {
        return deployment.target.id === siteId;
      });
      if (deployment) {
        if (options.prompt) {
          const confirmed = await Confirm.prompt({
            message: `Update site at ${deployment.target.url}?`,
            default: true,
          });
          if (!confirmed) {
            throw new Error();
          }
        }
        return deployment;
      } else {
        throw new Error(
          `No previous publish with site-id ${siteId} was found`,
        );
      }
    } else if (options.prompt) {
      return await chooseDeployment(deployments);
    } else if (deployments.length === 1) {
      return deployments[0];
    } else {
      throw new Error(
        `Multiple previous site publishes exists (specify one with --site-id when using --no-prompt)`,
      );
    }
  } else if (!options.prompt) {
    // if we get this far then an existing deployment has not been chosen,
    // if --no-prompt is specified then this is an error state
    if (!options.prompt) {
      throw new Error(
        `No previous publishes available to re-publish (previous publish required with --no-prompt)`,
      );
    }
  }
}

export async function publishDeployments(
  options: PublishOptions,
  providerFilter?: string,
): Promise<PublishDeployment[]> {
  const deployments: PublishDeployment[] = [];
  const config = typeof (options.input) === "string"
    ? readPublishDeployments(options.input)
    : readProjectPublishDeployments(options.input);
  for (const providerName of Object.keys(config)) {
    if (providerFilter && (providerName !== providerFilter)) {
      continue;
    }
    const provider = findProvider(providerName);
    if (provider) {
      // try to update urls if we have an account to bind to
      const account = await resolveAccount(provider, "never");
      for (const record of config[providerName]) {
        if (account) {
          const target = await provider.resolveTarget(account, record);
          if (target) {
            deployments.push({ provider, target });
          }
        } else {
          deployments.push({ provider, target: record });
        }
      }
    } else {
      warning(`Unkonwn provider ${providerName}`);
    }
  }

  return deployments;
}

export async function chooseDeployment(
  depoyments: PublishDeployment[],
): Promise<PublishDeployment | undefined> {
  const options = depoyments.map((deployment) => {
    return {
      name: `${deployment.target.url} (${deployment.provider.description})`,
      value: deployment.target.url,
    };
  });
  options.push({
    name: "Another destination...",
    value: "other",
  });

  const confirm = await Select.prompt({
    indent: "",
    message: "Publish to:",
    options,
  });

  if (confirm !== "other") {
    return depoyments.find((deployment) => deployment.target.url === confirm);
  } else {
    return undefined;
  }
}
