/*
 * deployment.ts
 *
 * Copyright (C) 2020-2022 Posit Software, PBC
 */

import { warning } from "log/mod.ts";

import { Select } from "cliffy/prompt/select.ts";
import { Confirm } from "cliffy/prompt/confirm.ts";

import { findProvider, publishProviders } from "../../publish/provider.ts";

import {
  AccountToken,
  PublishDeploymentWithAccount,
  PublishProvider,
} from "../../publish/provider-types.ts";

import { PublishOptions, PublishRecord } from "../../publish/types.ts";
import {
  readProjectPublishDeployments,
  readPublishDeployments,
} from "../../publish/config.ts";
import {
  publishRecordIdentifier,
  readAccountsPublishedTo,
} from "../../publish/common/data.ts";

export async function resolveDeployment(
  options: PublishOptions,
  providerFilter?: string,
): Promise<PublishDeploymentWithAccount | undefined> {
  // enumerate any existing deployments
  const deployments = await publishDeployments(
    options,
    providerFilter,
  );

  if (deployments && deployments.length > 0) {
    // if a site-id was passed then try to match it
    const siteId = options.id;
    if (siteId) {
      const deployment = deployments.find((deployment) => {
        return deployment.target.id === siteId;
      });
      if (deployment) {
        if (options.prompt) {
          const confirmed = await Confirm.prompt({
            indent: "",
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
      // confirm prompt
      const confirmPrompt = async (hint?: string) => {
        return await Confirm.prompt({
          indent: "",
          message: `Update site at ${deployments[0].target.url}?`,
          default: true,
          hint,
        });
      };

      if (
        deployments.length === 1 && deployments[0].provider.publishRecord &&
        providerFilter === deployments[0].provider.name
      ) {
        const confirmed = await confirmPrompt();
        if (confirmed) {
          return deployments[0];
        } else {
          throw new Error();
        }
      } else {
        return await chooseDeployment(deployments);
      } 
    } else if (deployments.length === 1) {
      return deployments[0];
    } else {
      throw new Error(
        `Multiple previous publishes exist (specify one with --id when using --no-prompt)`,
      );
    }
  } else if (!options.prompt) {
    // if we get this far then an existing deployment has not been chosen,
    // if --no-prompt is specified then this is an error state
    if (!options.prompt) {
      throw new Error(
        `No _publish.yml file available (_publish.yml specifying a destination required for non-interactive publish)`,
      );
    }
  }
}

export async function publishDeployments(
  options: PublishOptions,
  providerFilter?: string,
): Promise<PublishDeploymentWithAccount[]> {
  const deployments: PublishDeploymentWithAccount[] = [];

  // see if there are any static publish records for this directory
  for (const provider of publishProviders()) {
    if (
      (!providerFilter || providerFilter === provider.name) &&
      provider.publishRecord
    ) {
      const record = await (provider.publishRecord(options.input));
      if (record) {
        deployments.push({
          provider,
          target: record,
        });
      }
    }
  }

  // read config
  const config = typeof (options.input) === "string"
    ? readPublishDeployments(options.input)
    : readProjectPublishDeployments(options.input);
  for (const providerName of Object.keys(config.records)) {
    if (providerFilter && (providerName !== providerFilter)) {
      continue;
    }

    const provider = findProvider(providerName);
    if (provider) {
      // try to update urls if we have an account to bind to
      for (const record of config.records[providerName]) {
        let account: AccountToken | undefined;
        const publishedToAccounts = await readAccountsPublishedTo(
          options.input,
          provider,
          record,
        );

        if (publishedToAccounts.length === 1) {
          account = publishedToAccounts[0];
        }

        if (account) {
          const target = await resolveDeploymentTarget(
            provider,
            account,
            record,
          );
          if (target) {
            deployments.push({
              provider,
              target,
              account,
            });
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
  depoyments: PublishDeploymentWithAccount[],
): Promise<PublishDeploymentWithAccount | undefined> {
  // filter out deployments w/o target url (provided from cli)
  depoyments = depoyments.filter((deployment) => !!deployment.target.url);

  // collect unique origins
  const originCounts = depoyments.reduce((origins, deployment) => {
    try {
      const originUrl = new URL(deployment.target.url!).origin;
      const count = origins.get(originUrl) || 0;
      origins.set(originUrl, count + 1);
    } catch {
      // url may not be valid and that shouldn't cause an error
    }
    return origins;
  }, new Map<string, number>());

  const kOther = "other";
  const options = depoyments
    .map((deployment) => {
      let url = deployment.target.url;
      try {
        const targetOrigin = new URL(deployment.target.url!).origin;
        if (
          originCounts.get(targetOrigin) === 1 &&
          (deployment.provider?.listOriginOnly ?? false)
        ) {
          url = targetOrigin;
        }
      } catch {
        // url may not be valid and that shouldn't cause an error
      }

      return {
        name: `${url} (${deployment.provider.description}${
          deployment.account ? (" - " + deployment.account.name) : ""
        })`,
        value: publishRecordIdentifier(deployment.target, deployment.account),
      };
    });
  options.push({
    name: "Add a new destination...",
    value: kOther,
  });

  const confirm = await Select.prompt({
    indent: "",
    message: "Publish update to:",
    options,
  });

  if (confirm !== kOther) {
    return depoyments.find((deployment) =>
      publishRecordIdentifier(deployment.target, deployment.account) === confirm
    );
  } else {
    return undefined;
  }
}

async function resolveDeploymentTarget(
  provider: PublishProvider,
  account: AccountToken,
  record: PublishRecord,
) {
  try {
    return await provider.resolveTarget(account, record);
  } catch (err) {
    if (provider.isNotFound(err)) {
      warning(
        `${record.url} not found (you may need to remove it from the publish configuration)`,
      );
      return undefined;
    } else if (!provider.isUnauthorized(err)) {
      throw err;
    }
  }

  return record;
}
