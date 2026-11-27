/*
* cmd.ts
*
* Copyright (C) 2020-2022 Posit Software, PBC
*
*/

import { debug, error, info } from "../../../src/deno_ral/log.ts";
import { exec, type ExitStatus } from "../../../src/deno_ral/process.ts";

export interface CmdResult {
  status: ExitStatus;
  stdout: string;
  stderr: string;
}

export async function runCmd(
  runCmd: string,
  args: string[],
): Promise<CmdResult> {
  info([runCmd, ...args]);
  info(`Starting ${runCmd}`);
  const output = await exec(runCmd, { args });
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
    throw Error(
      `Command ${[runCmd, ...args]} failed.\n${stdout}\n${stderr}`,
    );
  }

  return {
    status: { success: output.success, code: output.code, signal: output.signal },
    stdout,
    stderr,
  };
}
