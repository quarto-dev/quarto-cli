/*
 * run.ts
 *
 * Copyright (C) 2020-2024 Posit Software, PBC
 */

import { Builtins, Command, Option } from "npm:clipanion";

import { existsSync } from "../../deno_ral/fs.ts";
import { error } from "../../deno_ral/log.ts";
import { handlerForScript } from "../../core/run/run.ts";
import { exitWithCleanup } from "../../core/cleanup.ts";

export async function runScript(args: string[], env?: Record<string, string>) {
  const script = args[0];
  if (!script) {
    error("quarto run: no script specified");
    exitWithCleanup(1);
    throw new Error(); // unreachable
  }
  if (!existsSync(script)) {
    error("quarto run: script '" + script + "' not found");
    exitWithCleanup(1);
    throw new Error(); // unreachable
  }
  const handler = await handlerForScript(script);
  if (!handler) {
    error("quarto run: no handler found for script '" + script + "'");
    exitWithCleanup(1);
    throw new Error(); // unreachable
  }
  return await handler.run(script, args.slice(1), undefined, { env });
}

export class RunCommand extends Command {
  static name = 'run';
  static paths = [[RunCommand.name]];

  static usage = Command.Usage({
    description:
        "Run a TypeScript, R, Python, or Lua script.\n\n" +
        "Run a utility script written in a variety of languages. For details, see:\n" +
        "https://quarto.org/docs/projects/scripts.html#periodic-scripts",
  });

  script = Option.String();
  args = Option.Proxy();

  async execute() {
    // help command is consumed by Option.Proxy
    // see https://github.com/arcanis/clipanion/issues/88
    const helpFlags = new Set(Builtins.HelpCommand.paths.map(path => path[0]));
    const helpFlagIndex = this.args.findIndex(flag => helpFlags.has(flag));
    if (-1 < helpFlagIndex && helpFlagIndex < [...this.args, '--'].indexOf('--')) {
      this.context.stdout.write(this.cli.usage(RunCommand, {detailed: true}));
      return;
    }

    const result = await runScript([this.script, ...this.args], this.context.env as Record<string, string>);
    Deno.exit(result.code);
  }
}
