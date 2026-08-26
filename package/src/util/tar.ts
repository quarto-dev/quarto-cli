/*
 * tar.ts
 *
 * Copyright (C) 2020-2022 Posit Software, PBC
 */

import { info } from "../../../src/deno_ral/log.ts";
import { dirname, extname } from "../../../src/deno_ral/path.ts";
import { existsSync } from "../../../src/deno_ral/fs.ts";
import { os } from "../../../src/deno_ral/platform.ts";

export function windowsSystemTar(systemRoot?: string): string {
  return `${systemRoot || "C:\\Windows"}\\System32\\tar.exe`;
}

// Git for Windows may put GNU tar on PATH, where it cannot extract ZIP files
// from Windows paths. Prefer the system bsdtar and preserve PATH as a fallback.
export function resolveTarBinary(
  os: string,
  systemTarPath: string | undefined,
): string {
  if (os !== "windows") {
    return "tar";
  }
  return systemTarPath ?? "tar";
}

// ZIP archives need no compression flag; bsdtar detects their format.
export function tarCompressFlag(input: string): string {
  const ext = extname(input).toLowerCase();
  if (ext === ".xz") {
    return "J";
  } else if (ext === ".bz2") {
    return "j";
  } else if (ext === ".zip") {
    return "";
  }
  return "z";
}

export function unTarCommand(
  tarBin: string,
  input: string,
  directory?: string,
): string[] {
  const cmd = [tarBin, `-xv${tarCompressFlag(input)}f`, input];
  if (directory) {
    cmd.push("--directory");
    cmd.push(directory);
  }
  return cmd;
}

export function makeTarballCommand(
  tarBin: string,
  input: string,
  output: string,
  changewd: boolean,
): string[] {
  const cmd = [tarBin, "czvf", output];
  if (changewd) {
    cmd.push("-C");
  }
  cmd.push(input);
  if (changewd) {
    cmd.push(".");
  }
  return cmd;
}

function currentTarBinary(): string {
  const systemTarPath = windowsSystemTar(Deno.env.get("WINDIR"));
  return resolveTarBinary(
    os,
    existsSync(systemTarPath) ? systemTarPath : undefined,
  );
}

export async function makeTarball(
  input: string,
  output: string,
  changewd = false,
) {
  info("Make Tarball");
  info(`Input: ${input}`);
  info(`Output: ${output}\n`);
  const tarCmd = makeTarballCommand(
    currentTarBinary(),
    input,
    output,
    changewd,
  );

  info(tarCmd);
  // @ts-expect-error `Deno.run()` is soft-removed as of Deno 2; the runtime keeps it.
  const p = Deno.run({
    cmd: tarCmd,
  });
  const status = await p.status();
  if (status.code !== 0) {
    throw Error(
      `Failure to make tarball ${output} using ${
        tarCmd[0]
      } (exit ${status.code}). Command was: ${tarCmd.join(" ")}`,
    );
  }
}

export async function unTar(input: string, directory?: string) {
  info("Untar");
  info(`Input: ${input}`);

  const cwd = dirname(input);
  info(`Cwd: ${cwd}`);

  const tarCmd = unTarCommand(currentTarBinary(), input, directory);

  info(tarCmd);
  // @ts-expect-error `Deno.run()` is soft-removed as of Deno 2; the runtime keeps it.
  const p = Deno.run({
    cmd: tarCmd,
    cwd,
  });
  const status = await p.status();
  if (status.code !== 0) {
    const systemTarPath = windowsSystemTar(Deno.env.get("WINDIR"));
    const fallbackNote = os === "windows" && tarCmd[0] === "tar"
      ? ` ${systemTarPath} was not found, so tar was resolved from PATH.`
      : "";
    throw Error(
      `Failure to untar ${input} using ${
        tarCmd[0]
      } (exit ${status.code}).${fallbackNote} Command was: ${
        tarCmd.join(" ")
      }`,
    );
  }
}
