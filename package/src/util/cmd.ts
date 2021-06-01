/*
* cmd.ts
*
* Copyright (C) 2020 by RStudio, PBC
*
*/

import { error, info } from "log/mod.ts";

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
  info(stdout);

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
