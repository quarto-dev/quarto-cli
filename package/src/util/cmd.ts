/*
* cmd.ts
*
* Copyright (C) 2020-2022 Posit Software, PBC
*
*/

import { debug, error, info } from "../../../src/deno_ral/log.ts";

export interface CmdResult {
  status: Deno.CommandStatus;
  stdout: string;
  stderr: string;
}

export async function runCmd(
  runCmd: string,
  args: string[],
): Promise<CmdResult> {
  // const cmd: string[] = [];
  // cmd.push(runCmd);
  // cmd.push(...args);

  info([runCmd, ...args]);
  info(`Starting ${runCmd}`);
  const cmd = new Deno.Command(runCmd, {
    args,
    stdout: "piped",
    stderr: "piped",
  });
  const output = await cmd.output();
  const stdout = new TextDecoder().decode(output.stdout);
  const stderr = new TextDecoder().decode(output.stderr);
  info(`Finished ${runCmd}`);
  debug(stdout);

  const code = output.code;
  info(`Status ${code}`);
  if (code !== 0) {
    // Some tools (e.g. xcrun stapler) write their actual failure reason to
    // stdout rather than stderr; without this, that reason is only visible
    // at debug level and failures show an empty error message.
    error(stdout);
    error(stderr);
    throw Error(`Command ${[runCmd, ...args]} failed.`);
  }

  return {
    status: output,
    stdout,
    stderr,
  };
}
