/*
* options.ts
*
* Copyright (C) 2020 by RStudio, PBC
*
*/

import { Command } from "cliffy/command/command.ts";
import { ProjectContext } from "../../project/types.ts";

export type PublishOptions = {
  project: ProjectContext;
  render: boolean;
  prompt: boolean;
  ["site-id"]?: string;
};

export interface PublishCommandOptions {
  render?: boolean;
  prompt?: boolean;
  ["site-id"]?: string;
}

export function withPublishOptions(
  command: Command<PublishCommandOptions>,
  // deno-lint-ignore no-explicit-any
): Command<any> {
  return command
    .arguments("[path:string]")
    .option(
      "--no-render",
      "Do not render before publishing.",
    )
    .option(
      "--no-prompt",
      "Do not prompt to confirm publishing destination",
    )
    .option(
      "--site-id",
      "Identifier of site to publish",
    );
}
