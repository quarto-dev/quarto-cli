/*
* deno.ts
*
* Copyright (C) 2020-2022 Posit Software, PBC
*
*/
import { execProcess } from "../../../src/core/process.ts";
import { info } from "../../../src/deno_ral/log.ts";
import { isWindows } from "../../../src/deno_ral/platform.ts";
import { Configuration } from "../common/config.ts";

// TODO in we only use the bundler for quarto.ts
// so we hardcode it in the new esbuild-based bundler
export async function bundle(
  configuration: Configuration,
) {
  // Bundle source code
  const denoBundleCmd: string[] = [];
  const denoExecPath = Deno.env.get("QUARTO_DENO");
  if (!denoExecPath) {
    throw Error("QUARTO_DENO is not defined");
  }
  denoBundleCmd.push("run");
  denoBundleCmd.push("--allow-all");
  denoBundleCmd.push("../tools/deno-esbuild-bundle.ts");
  /*
  denoBundleCmd.push("--log-level");
  denoBundleCmd.push("debug");
  */
  // denoBundleCmd.push(input);
  // denoBundleCmd.push(output);

  const status = await execProcess({
    cmd: denoExecPath,
    args: denoBundleCmd,
    cwd: configuration.directoryInfo.src,
  });
  if (status.code !== 0) {
    throw Error(`Failure to bundle src/quarto.ts`);
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
  denoBundleCmd.push("compile");
  denoBundleCmd.push("--unstable-kv");
  denoBundleCmd.push("--unstable-ffi");
  // --enable-experimental-regexp-engine is required for /regex/l, https://github.com/quarto-dev/quarto-cli/issues/9737
  denoBundleCmd.push("--v8-flags=--enable-experimental-regexp-engine,--stack-trace-limit=100");
  denoBundleCmd.push(
    "--importmap=" + configuration.importmap,
  );
  denoBundleCmd.push("--output");
  denoBundleCmd.push(output);
  denoBundleCmd.push(...flags);

  denoBundleCmd.push(input);

  const status = await execProcess({
    cmd: denoExecPath, 
    args: denoBundleCmd,
  });
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
  denoBundleCmd.push("install");
  denoBundleCmd.push("--unstable-kv");
  denoBundleCmd.push("--unstable-ffi");
  denoBundleCmd.push(
    "--importmap=" + configuration.importmap,
  );
  denoBundleCmd.push(...flags);

  denoBundleCmd.push(input);

  const status = await execProcess({
    cmd: denoExecPath,
    args: denoBundleCmd,
    stdout: "piped",
  });
  if (status.code !== 0) {
    throw Error(`Failure to install ${input}`);
  }
  if (status.stdout) {
    // Forward the output
    info(status.stdout);

    const match = status.stdout.match(/Successfully installed.*\n(.*)/);
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
    const finalTxt = isWindows
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
