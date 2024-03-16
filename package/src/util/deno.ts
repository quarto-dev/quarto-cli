/*
* deno.ts
*
* Copyright (C) 2020-2022 Posit Software, PBC
*
*/
import { info } from "../../../src/deno_ral/log.ts";
import { Configuration } from "../common/config.ts";

export async function bundle(
  input: string,
  output: string,
  configuration: Configuration,
) {
  // Bundle source code
  const denoBundleCmd: string[] = [];
  const denoExecPath = Deno.env.get("QUARTO_DENO");
  if (!denoExecPath) {
    throw Error("QUARTO_DENO is not defined");
  }
  denoBundleCmd.push(denoExecPath);
  denoBundleCmd.push("bundle");
  denoBundleCmd.push("--unstable-ffi");
  denoBundleCmd.push(
    "--importmap=" + configuration.importmap,
  );
  /*
  denoBundleCmd.push("--log-level");
  denoBundleCmd.push("debug");
  */

  denoBundleCmd.push(input);
  denoBundleCmd.push(output);

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
  const denoExecPath = Deno.env.get("QUARTO_DENO");
  if (!denoExecPath) {
    throw Error("QUARTO_DENO is not defined");
  }
  denoBundleCmd.push(denoExecPath);
  denoBundleCmd.push("compile");
  denoBundleCmd.push("--unstable-ffi");
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
  const denoExecPath = Deno.env.get("QUARTO_DENO");
  if (!denoExecPath) {
    throw Error("QUARTO_DENO is not defined");
  }
  denoBundleCmd.push(denoExecPath);
  denoBundleCmd.push("install");
  denoBundleCmd.push("--unstable-ffi");
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

export function updateDenoPath(installPath: string, _config: Configuration) {
  // Fix up the path to deno
  if (installPath) {
    info("Updating install script deno path");
    const installTxt = Deno.readTextFileSync(installPath);
    const denoExecPath = Deno.env.get("QUARTO_DENO");
    if (!denoExecPath) {
      throw Error("QUARTO_DENO is not defined");
    }
    const finalTxt = Deno.build.os === "windows"
      ? installTxt.replace(
        /deno.exe /g,
        denoExecPath + " ",
      )
      : installTxt.replace(
        /deno /g,
        denoExecPath + " ",
      );
    Deno.writeTextFileSync(
      installPath,
      finalTxt,
    );
  }
}
