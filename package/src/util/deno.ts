/*
* deno.ts
*
* Copyright (C) 2020 by RStudio, PBC
*
*/
import { info } from "log/mod.ts";
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
  /*
  denoBundleCmd.push("--log-level");
  denoBundleCmd.push("debug");
  */

  denoBundleCmd.push(input);
  denoBundleCmd.push(output);
  info(denoBundleCmd);

  const p = Deno.run({
    cmd: denoBundleCmd,
  });
  const status = await p.status();
  if (status.code !== 0) {
    throw Error(`Failure to bundle ${input}`);
  }
}

export async function compile(
  input: string,
  output: string,
  flags: string[],
  configuration: Configuration,
) {
  const denoBundleCmd: string[] = [];
  denoBundleCmd.push(join(configuration.directoryInfo.bin, "deno"));
  denoBundleCmd.push("compile");
  denoBundleCmd.push("--unstable");
  denoBundleCmd.push(
    "--importmap=" + configuration.importmap,
  );
  denoBundleCmd.push("--output");
  denoBundleCmd.push(output);
  denoBundleCmd.push(...flags);

  denoBundleCmd.push(input);
  const p = Deno.run({
    cmd: denoBundleCmd,
  });
  const status = await p.status();
  if (status.code !== 0) {
    throw Error(`Failure to compile ${input}`);
  }
}

export async function install(
  input: string,
  flags: string[],
  configuration: Configuration,
) {
  const denoBundleCmd: string[] = [];
  denoBundleCmd.push(join(configuration.directoryInfo.bin, "deno"));
  denoBundleCmd.push("install");
  denoBundleCmd.push("--unstable");
  denoBundleCmd.push(
    "--importmap=" + configuration.importmap,
  );
  denoBundleCmd.push(...flags);

  denoBundleCmd.push(input);

  const p = Deno.run({
    cmd: denoBundleCmd,
    stdout: "piped",
  });
  const status = await p.status();
  if (status.code !== 0) {
    throw Error(`Failure to install ${input}`);
  }
  const output = await p.output();

  if (output) {
    // Try to read the installation path and return it
    const outputTxt = new TextDecoder().decode(output);

    // Forward the output
    info(outputTxt);

    const match = outputTxt.match(/Successfully installed.*\n(.*)/);
    if (match) {
      return match[1];
    }
  }

  return undefined;
}

export function updateDenoPath(installPath: string, config: Configuration) {
  // Fix up the path to deno
  if (installPath) {
    info("Updating install script deno path");
    const installTxt = Deno.readTextFileSync(installPath);
    const finalTxt = Deno.build.os === "windows"
      ? installTxt.replace(
        /deno.exe /g,
        join(config.directoryInfo.bin, "deno.exe") + " ",
      )
      : installTxt.replace(
        /deno /g,
        join(config.directoryInfo.bin, "deno") + " ",
      );
    Deno.writeTextFileSync(
      installPath,
      finalTxt,
    );
  }
}
