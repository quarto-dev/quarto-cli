/*
 * run.ts
 *
 * Copyright (C) 2020-2022 Posit Software, PBC
 */

import { Command } from "cliffy/command/command.ts";

import { existsSync } from "fs/exists.ts";
import { error } from "../../deno_ral/log.ts";
import { handlerForScript } from "../../core/run/run.ts";

export async function runScript(args: string[], env?: Record<string, string>) {
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
  return await handler.run(script, args.slice(1), undefined, { env });
}

// run 'command' (this is a fake command that is here just for docs,
// the actual processing of 'run' bypasses cliffy entirely)
export const runCommand = new Command()
  .name("run")
  .stopEarly()
  .arguments("[script:string] [...args]")
  .description(
    "Run a TypeScript, R, Python, or Lua script.\n\n" +
      "Run a utility script written in a variety of languages. For details, see:\n" +
      "https://quarto.org/docs/projects/scripts.html#periodic-scripts",
  );
