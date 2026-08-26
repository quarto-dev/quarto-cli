/*
* tar.ts
*
* Copyright (C) 2020-2022 Posit Software, PBC
*
*/

import { info } from "../../../src/deno_ral/log.ts";
import { dirname, extname } from "../../../src/deno_ral/path.ts";

// Deno 2 dropped Deno.run from its type definitions, but the runtime still
// implements it (verified: typeof Deno.run === "function" on Deno 2.7.14).
// Declaring its actual shape here fixes the TS2339 errors this file's tests
// would otherwise hit under `deno test --check`, instead of suppressing them;
// migrating off Deno.run to Deno.Command is out of scope. The shape below is
// deliberately minimal - just what this file's two call sites use, not the
// full Deno 1 RunOptions/Process API. Other files calling Deno.run (git.ts,
// configure.ts, import-report/*) have their own untested latent TS2339s;
// if a future change needs to type Deno.run more broadly across the
// codebase, that belongs in src/deno_ral/process.ts (which already wraps
// Deno.Command, the migration target), not a wider version of this block.
declare global {
  namespace Deno {
    function run(options: { cmd: string[]; cwd?: string }): {
      status(): Promise<{ code: number }>;
    };
  }
}

// Windows ships bsdtar as System32\tar.exe, which reads ZIP archives.
export function windowsSystemTar(systemRoot?: string): string {
  return `${systemRoot || "C:\\Windows"}\\System32\\tar.exe`;
}

// Resolve which tar to run. On Windows prefer the absolute System32 bsdtar: a
// GNU tar earlier on PATH - Git for Windows installs one in usr\bin, and
// anything launched from a Git Bash shell inherits that PATH - cannot read ZIP
// and reads a Windows absolute path as a remote host spec, so it fails every
// dependency extraction. configure.cmd calls the absolute System32 path for the
// Deno bootstrap for this same reason.
//
// Fall back to PATH when that file is not there. That does not make such a host
// work, since its PATH tar is the very binary that cannot read ZIP; it keeps
// this change from regressing a host we have not tested, and it means a wrong
// systemRoot degrades to today's behaviour instead of failing outright.
// Callers pass the existence result so this stays pure and both branches are
// testable.
export function resolveTarBinary(
  os: string,
  systemTarPath: string,
  systemTarExists: boolean,
): string {
  if (os !== "windows") {
    return "tar";
  }
  return systemTarExists ? systemTarPath : "tar";
}

// tar's compression flag for an archive. A .zip gets none: the format is not
// gzip, and bsdtar detects it unaided. Passing z for a zip happens to work
// under bsdtar's lenient format detection, which is what has kept the mistake
// invisible and made the GNU tar failure look like archive corruption.
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

// The command builders take an already-resolved binary, so the filesystem
// check stays out of them and a test can pass any binary string it likes.
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
