/*
 * cmd.ts
 *
 * Copyright (C) 2020-2024 Posit Software, PBC
 */

import { writeAllSync } from "io/write-all";
import { Command } from "npm:clipanion";
import { capabilities } from "./capabilities.ts";

export class CapabilitiesCommand extends Command {
  static name = 'capabilities';
  static paths = [[CapabilitiesCommand.name]];

  static usage = Command.Usage({
    category: 'internal',
    description: "Query for current capabilities (formats, engines, kernels etc.)",
  })

  async execute() {
    const capsJSON = JSON.stringify(await capabilities(), undefined, 2);
    writeAllSync(
        Deno.stdout,
        new TextEncoder().encode(capsJSON),
    );
  }
}
