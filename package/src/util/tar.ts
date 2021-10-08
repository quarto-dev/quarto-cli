/*
* tar.ts
*
* Copyright (C) 2020 by RStudio, PBC
*
*/

import { info } from "log/mod.ts";
import { dirname } from "path/mod.ts";

export async function makeTarball(
  input: string,
  output: string,
  changewd = false,
) {
  info("Make Tarball");
  info(`Input: ${input}`);
  info(`Output: ${output}\n`);
  const tarCmd: string[] = [];
  tarCmd.push("tar");
  tarCmd.push("czvf");
  tarCmd.push(output);
  if (changewd) {
    tarCmd.push("-C");
  }
  tarCmd.push(input);
  if (changewd) {
    tarCmd.push(".");
  }

  info(tarCmd);
  const p = Deno.run({
    cmd: tarCmd,
  });
  const status = await p.status();
  if (status.code !== 0) {
    throw Error("Failure to make tarball");
  }
}

export async function unTar(input: string) {
  info("Untar");
  info(`Input: ${input}`);

  const cwd = dirname(input);
  info(`Cwd: ${cwd}`);

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
