/*
* tar.ts
*
* Copyright (C) 2020 by RStudio, PBC
*
*/

import { dirname } from "path/mod.ts";

import { Logger } from "./logger.ts";

export async function makeTarball(
  input: string,
  output: string,
  log: Logger,
) {
  log.info("Make Tarball");
  log.info(`Input: ${input}`);
  log.info(`Output: ${output}\n`);
  const tarCmd: string[] = [];
  tarCmd.push("tar");
  tarCmd.push("czvf");
  tarCmd.push(output);
  tarCmd.push(input);

  const p = Deno.run({
    cmd: tarCmd,
  });
  const status = await p.status();
  if (status.code !== 0) {
    throw Error("Failure to make tarball");
  }
}

export async function unTar(input: string, log: Logger) {
  log.info("Untar");
  log.info(`Input: ${input}`);

  const cwd = dirname(input);
  log.info(`Cwd: ${cwd}`);

  const tarCmd: string[] = [];
  tarCmd.push("tar");
  tarCmd.push("-xzf");
  tarCmd.push(input);

  const p = Deno.run({
    cmd: tarCmd,
    cwd,
  });
  const status = await p.status();
  if (status.code !== 0) {
    throw Error("Failure to untar");
  }
}
