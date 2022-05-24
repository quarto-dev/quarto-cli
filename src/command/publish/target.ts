/*
* target.ts
*
* Copyright (C) 2020 by RStudio, PBC
*
*/

import { projectPublishConfig } from "../../publish/config.ts";
import {
  AccountToken,
  PublishOptions,
  PublishProvider,
  PublishTarget,
} from "../../publish/provider.ts";

export async function deployedTargets(
  provider: PublishProvider,
  options: PublishOptions,
  token?: AccountToken,
): Promise<PublishTarget[]> {
  const publishConfig = await projectPublishConfig(options.target);
  const targets = (publishConfig[provider.name] || []).map((site_id) => ({
    site_id,
  }));
  // resolve targets if we have a token
  if (token) {
    const resolvedTargets: PublishTarget[] = [];
    for (const target of targets) {
      resolvedTargets.push(await provider.resolveTarget(token, target));
    }
    return resolvedTargets;
  }
  return targets;
}
