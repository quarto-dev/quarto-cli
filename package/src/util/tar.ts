/*
* tar.ts
*
* Copyright (C) 2020-2022 Posit Software, PBC
*
*/

import { info } from "log/mod.ts";
import { dirname, extname } from "path/mod.ts";

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

export async function unTar(input: string, directory?: string) {
  info("Untar");
  info(`Input: ${input}`);

  const cwd = dirname(input);
  info(`Cwd: ${cwd}`);

  // Properly process the compressions
  let compressFlag = "z"; // zip by default
  const ext = extname(input);
  if (ext === ".xz") {
    compressFlag = "J";
  } else if (ext === ".bz2") {
    compressFlag = "j";
  }

  const tarCmd: string[] = [];
  tarCmd.push("tar");
  tarCmd.push(`-xv${compressFlag}f`);
  tarCmd.push(input);
  if (directory) {
    tarCmd.push("--directory");
    tarCmd.push(directory);
  }

  const p = Deno.run({
    cmd: tarCmd,
    cwd,
  });
  const status = await p.status();
  if (status.code !== 0) {
    throw Error("Failure to untar");
  }
}
