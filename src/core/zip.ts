/*
* zip.ts
*
* Copyright (C) 2020-2022 Posit Software, PBC
*
*/
import { dirname } from "path/mod.ts";
import { execProcess } from "./process.ts";
import { requireQuoting, safeWindowsExec } from "./windows.ts";

export function unzip(file: string) {
  const dir = dirname(file);

  if (file.endsWith("zip")) {
    // It's a zip file
    if (Deno.build.os === "windows") {
      const args = [
        "-Command",
        `"& { Add-Type -A 'System.IO.Compression.FileSystem'; [IO.Compression.ZipFile]::ExtractToDirectory('${file}', '${dir}'); }"`,
      ];
      return safeWindowsExec(
        "powershell",
        args,
        (cmd: string[]) => {
          return execProcess(
            {
              cmd: cmd,
              stdout: "piped",
            },
          );
        },
      );
    } else {
      // Use the built in unzip command
      return execProcess(
        { cmd: ["unzip", "-o", file], cwd: dir, stdout: "piped" },
      );
    }
  } else {
    // use the tar command to untar this
    return execProcess(
      { cmd: ["tar", "xfz", file], cwd: dir, stdout: "piped" },
    );
  }
}
