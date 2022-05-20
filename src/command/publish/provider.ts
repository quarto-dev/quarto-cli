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
  prompt: boolean;
}

export interface PublishProvider {
  name: string;
  description: string;
  // deno-lint-ignore no-explicit-any
  command: (command: Command<any>) => Command<any>;
  configure: (options: PublishOptions) => Promise<void>;
}
