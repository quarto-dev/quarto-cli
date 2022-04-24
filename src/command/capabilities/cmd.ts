/*
* cmd.ts
*
* Copyright (C) 2020 by RStudio, PBC
*
*/

import { writeAllSync } from "io/mod.ts";

import { Command } from "cliffy/command/mod.ts";
import { capabilities } from "./capabilities.ts";

export const capabilitiesCommand = new Command()
  .name("capabilities")
  .description(
    "Query for current capabilities (formats, engines, kernels etc.)",
  )
  .hidden()
  .action(async () => {
    const capsJSON = JSON.stringify(await capabilities(), undefined, 2);
    writeAllSync(
      Deno.stdout,
      new TextEncoder().encode(capsJSON),
    );
  });
