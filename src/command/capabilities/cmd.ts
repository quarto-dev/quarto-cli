/*
 * cmd.ts
 *
 * Copyright (C) 2020-2022 Posit Software, PBC
 */

import { writeStdoutSync } from "../../deno_ral/process.ts";
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
    writeStdoutSync(new TextEncoder().encode(capsJSON));
  });
