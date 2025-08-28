/*
 * cmd.ts
 *
 * Copyright (C) 2025 Posit Software, PBC
 */

import { Command } from "cliffy/command/mod.ts";
import { join } from "../../../deno_ral/path.ts";
import { resourcePath } from "../../../core/resources.ts";
import { execProcess } from "../../../core/process.ts";

export const makeAstDiagramCommand = new Command()
  .name("make-ast-diagram")
  .hidden()
  .arguments("<arguments...>")
  .description(
    "Creates a diagram of the Pandoc AST.\n\n",
  )
  .action(async (_options: unknown, ...args: string[]) => {
    const renderOpts = {
      cmd: Deno.execPath(),
      args: [
        "run",
        "--allow-read",
        "--allow-write",
        "--allow-run",
        resourcePath(join("tools", "ast-diagram", "main.ts")),
        ...args,
      ],
    };
    await execProcess(renderOpts);
  });
