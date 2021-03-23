/*
* dart-sass.ts
*
* Copyright (C) 2020 by RStudio, PBC
*
*/
import { join } from "path/mod.ts";

import { binaryPath } from "./resources.ts";
import { execProcess } from "./process.ts";

export async function dartSassInstallDir() {
  return await binaryPath("dart-sass");
}

export async function dartSassVersion() {
  return await dartCommand(["--version"]);
}

export async function dartCompile(
  input: string,
  loadPaths?: string[],
  compressed?: boolean,
): Promise<string | undefined> {
  const command = Deno.build.os === "windows" ? "sass.bat" : "sass";
  const sass = binaryPath(join("dart-sass", command));
  const args = [
    "--stdin",
    "--style",
    compressed ? "compressed" : "expanded",
  ];

  if (loadPaths) {
    loadPaths.forEach((loadPath) => {
      args.push(`--load-path=${loadPath}`);
    });
  }

  return await dartCommand(args, input);
}

async function dartCommand(args: string[], stdin?: string) {
  const command = Deno.build.os === "windows" ? "sass.bat" : "sass";
  const sass = binaryPath(join("dart-sass", command));
  const cmd = [
    sass,
    ...args,
  ];

  // Run the sas compiler
  const result = await execProcess(
    {
      cmd,
      stdout: "piped",
    },
    stdin,
  );

  if (result.success) {
    return result.stdout;
  } else {
    throw new Error("Sass command failed");
  }
}
