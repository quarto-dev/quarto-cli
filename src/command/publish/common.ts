/*
* common.ts
*
* Copyright (C) 2020 by RStudio, PBC
*
*/

import { Command } from "cliffy/command/mod.ts";

export interface PublishOptions {
  path: string;
  render: boolean;
}

export function publishSubcommand(name: string, description: string) {
  return new Command()
    .name(name)
    .description(description)
    .arguments("[path:string]")
    .option(
      "--no-render",
      "Do not render before publishing.",
    );
}
