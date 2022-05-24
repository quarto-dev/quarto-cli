/*
* target.ts
*
* Copyright (C) 2020 by RStudio, PBC
*
*/

import { Input } from "cliffy/prompt/mod.ts";

import { projectPublishConfig } from "../../publish/config.ts";
import {
  PublishOptions,
  PublishProvider,
  PublishTarget,
} from "../../publish/provider.ts";

export async function resolveTarget(
  provider: PublishProvider,
  options: PublishOptions,
): Promise<PublishTarget> {
  // read existing publish config
  const publishConfig = await projectPublishConfig(options.target);

  if (!publishConfig) {
  } else {
    const target: string = await Input.prompt({
      message: "Site name",
      hint: provider.targetHint(),
    });
  }

  return { site: "foo" };
}
