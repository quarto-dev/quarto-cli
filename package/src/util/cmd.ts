/*
* cmd.ts
*
* Copyright (C) 2020-2022 Posit Software, PBC
*
*/

import { debug, error, info } from "../../../src/deno_ral/log.ts";

export interface CmdResult {
  status: Deno.ProcessStatus;
  stdout: string;
  stderr: string;
}

export async function runCmd(
  runCmd: string,
  args: string[],
): Promise<CmdResult> {
  const cmd: string[] = [];
  cmd.push(runCmd);
  cmd.push(...args);

  info(cmd);
  info(`Starting ${runCmd}`);
  const p = Deno.run({
    cmd,
    stdout: "piped",
    stderr: "piped",
  });
  const stdout = new TextDecoder().decode(await p.output());
  const stderr = new TextDecoder().decode(await p.stderrOutput());
  info(`Finished ${runCmd}`);
  debug(stdout);

  const status = await p.status();
  info(`Status ${status.code}`);
  if (status.code !== 0) {
    error(stderr);
    throw Error(`Command ${cmd} failed.`);
  }

  // Close the child process
  p.close();

  return {
    status,
    stdout,
    stderr,
  };
}
