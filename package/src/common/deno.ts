import { join } from "https://deno.land/std/path/mod.ts";

import { Configuration } from "./config.ts";

export async function bundle(
  input: string,
  output: string,
  configuration: Configuration,
) {
  // TODO: Use Deno.bundle instead?
  // Bundle source code
  const denoBundleCmd: string[] = [];
  denoBundleCmd.push(join(configuration.dirs.bin, "deno"));
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
