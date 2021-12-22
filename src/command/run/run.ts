/*
* run.ts
*
* Copyright (C) 2020 by RStudio, PBC
*
*/

import { existsSync } from "fs/exists.ts";
import { error } from "log/mod.ts";
import { handlerForScript } from "../../core/run/run.ts";

export async function runScript(args: string[]) {
  const script = args[0];
  if (!script) {
    error("quarto run: no script specified");
    Deno.exit(1);
  }
  if (!existsSync(script)) {
    error("quarto run: script '" + script + "' not found");
    Deno.exit(1);
  }
  const handler = await handlerForScript(script);
  if (!handler) {
    error("quarto run: no handler found for script '" + script + "'");
    Deno.exit(1);
  }
  return await handler.run(script, args.slice(1));
}
