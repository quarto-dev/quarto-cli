/*
 * chrome-launch-fixtures.ts
 *
 * Copyright (C) 2026 Posit Software, PBC
 */

import { join } from "path";

/**
 * Writes a small Deno script plus a platform-native wrapper that re-invokes
 * the currently running deno binary to run it (.cmd on Windows, a shebang
 * script on Unix). A wrapper is needed because launchChrome()/criClient()
 * always prepend real Chrome flags as argv, which the fake executable must
 * tolerate. Returns the wrapper's path.
 *
 * The wrapper re-invokes deno.exe as a grandchild: on Windows, kill() only
 * reaches the direct child (the .cmd's cmd.exe host), and the deno.exe
 * grandchild survives as an orphan holding its inherited stderr pipe open,
 * which would otherwise hang launchChrome's close() forever. Callers whose
 * script keeps a listener or server running should have it self-terminate
 * on its own timer rather than relying on close() to reach it.
 */
export async function writeFakeExecutable(
  dir: string,
  name: string,
  scriptLines: string[],
  allowWritePath?: string,
): Promise<string> {
  const scriptPath = join(dir, `${name}.js`);
  await Deno.writeTextFile(scriptPath, scriptLines.join("\n"));

  const deno = Deno.execPath();
  const allowWrite = allowWritePath
    ? ` --allow-write="${allowWritePath}"`
    : "";
  if (Deno.build.os === "windows") {
    const cmdPath = join(dir, `${name}.cmd`);
    await Deno.writeTextFile(
      cmdPath,
      `@echo off\r\n"${deno}" run --allow-net${allowWrite} "${scriptPath}" %*\r\n`,
    );
    return cmdPath;
  }
  const shPath = join(dir, `${name}.sh`);
  await Deno.writeTextFile(
    shPath,
    `#!/bin/sh\n"${deno}" run --allow-net${allowWrite} "${scriptPath}" "$@"\n`,
  );
  await Deno.chmod(shPath, 0o755);
  return shPath;
}
