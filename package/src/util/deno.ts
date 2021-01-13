/*
* deno.ts
*
* Copyright (C) 2020 by RStudio, PBC
*
*/
import { join } from "path/mod.ts";
import { Configuration } from "../common/config.ts";

export async function bundle(
  input: string,
  output: string,
  configuration: Configuration,
) {
  // Bundle source code
  const denoBundleCmd: string[] = [];
  denoBundleCmd.push(join(configuration.directoryInfo.bin, "deno"));
  denoBundleCmd.push("bundle");
  denoBundleCmd.push("--unstable");
  denoBundleCmd.push(
    "--importmap=" + configuration.importmap,
  );

  denoBundleCmd.push(input);
  denoBundleCmd.push(output);
  const p = Deno.run({
    cmd: denoBundleCmd,
  });
  const status = await p.status();
  if (status.code !== 0) {
    throw Error("Failure to bundle quarto.ts");
  }
}

export async function compile(
  input: string,
  configuration: Configuration) {

  const denoBundleCmd: string[] = [];
  denoBundleCmd.push(join(configuration.directoryInfo.bin, "deno"));
  denoBundleCmd.push("compile");
  denoBundleCmd.push("--unstable");
  denoBundleCmd.push(
    "--importmap=" + configuration.importmap,
  );

  denoBundleCmd.push(input);
  const p = Deno.run({
    cmd: denoBundleCmd,
  });
  const status = await p.status();
  if (status.code !== 0) {
    throw Error("Failure to compile quarto.ts");
  }

}
